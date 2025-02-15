import { App } from '@slack/bolt'
import { TripleWhaleClient } from './lib/triplewhale'
import { eq, and, ne } from 'drizzle-orm'
import { URLSearchParams } from 'url'
import db from '@sabi/database'
import { workspaceBrands, slackWorkspaces, brands, user } from '@sabi/database/src/schema'

function formatMathExpressions(text: string): string {
  return text.replace(/\\\((.*?)\\\)/g, (_, expression) => {
    try {
      const cleanExpression = expression.replace(/,/g, '').trim()
      const result = new Function(`return ${cleanExpression}`)()
      return result.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    } catch (error) {
      console.error('Error evaluating math expression:', error)
      return expression
    }
  })
}

function formatCurrency(text: string): string {
  return text.replace(/\$(\d{1,3}(,\d{3})*(\.\d{2})?)/g, (match) => {
    try {
      const value = parseFloat(match.replace(/[$,]/g, ''))
      return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      })
    } catch (error) {
      return match
    }
  })
}

function formatMessage(text: string): string {
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    .replace(/<<.*?>>/g, '')
    .replace(/<!-- .*? -->/g, '')
    .replace(/<.*?>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  formatted = formatMathExpressions(formatted)
  formatted = formatCurrency(formatted)
  return formatted
}

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  clientId: process.env.SLACK_CLIENT_ID!,
  clientSecret: process.env.SLACK_CLIENT_SECRET!,
  stateSecret: process.env.SLACK_STATE_SECRET!,
  scopes: [
    'app_mentions:read',
    'channels:read',
    'channels:join',
    'chat:write',
    'commands',
    'groups:read',
    'im:history',
    'im:read',
    'im:write',
    'mpim:read',
    'mpim:write',
    'team:read',
    'users:read',
    'users:read.email',
    'views:write',
    'commands'
  ],
  customRoutes: [
    {
      path: '/api/oauth/callback',
      method: ['GET'],
      handler: async (req, res) => {
        try {
          const url = req.url || ''
          const urlParams = new URLSearchParams(url.split('?')[1] || '')
          const code = urlParams.get('code')
          const state = urlParams.get('state')

          if (!code) {
            res.writeHead(400)
            res.end('Authorization code is required')
            return
          }

          if (!state) {
            res.writeHead(400)
            res.end('State parameter is required')
            return
          }

          const brandId = state

          const tokenResponse = await fetch('https://api.triplewhale.com/api/v2/auth/oauth2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: process.env.TRIPLEWHALE_CLIENT_ID!,
              client_secret: process.env.TRIPLEWHALE_CLIENT_SECRET!,
              code,
              redirect_uri: process.env.REDIRECT_URI!,
              grant_type: 'authorization_code'
            }).toString()
          })

          if (!tokenResponse.ok) {
            console.error('Token exchange failed:', await tokenResponse.text())
            res.writeHead(tokenResponse.status)
            res.end('Failed to exchange authorization code')
            return
          }

          const tokens = await tokenResponse.json()

          if (!tokens.access_token || !tokens.refresh_token || !tokens.expires_in) {
            console.error('Invalid token response:', tokens)
            res.writeHead(400)
            res.end('Invalid token response from Triple Whale')
            return
          }

          const now = new Date()
          const accessTokenExpiresAt = new Date(now.getTime() + (tokens.expires_in * 1000))
          const refreshTokenExpiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000))

          await db.update(brands)
            .set({
              tripleWhaleAccessToken: tokens.access_token,
              tripleWhaleRefreshToken: tokens.refresh_token,
              tripleWhaleAccessTokenExpiresAt: accessTokenExpiresAt,
              tripleWhaleRefreshTokenExpiresAt: refreshTokenExpiresAt,
              updatedAt: now
            })
            .where(eq(brands.id, brandId))

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body>
                <h1>Successfully connected!</h1>
                <p>You can close this window and return to the app.</p>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ type: 'TRIPLE_WHALE_AUTH_SUCCESS' }, '*');
                  }
                  setTimeout(() => window.close(), 1000);
                </script>
              </body>
            </html>
          `)
        } catch (error) {
          console.error('Error in OAuth callback:', error)
          res.writeHead(500)
          res.end('Authorization failed')
        }
      }
    }
  ],
  installationStore: {
    storeInstallation: async (installation) => {
      try {
        const now = new Date()
        const teamId = installation.team?.id
        if (!teamId) {
          throw new Error('Missing team ID in installation')
        }

        const userInfo = await app.client.users.info({
          token: installation.bot?.token,
          user: installation.user.id
        });

        const userEmail = userInfo.user?.profile?.email;
        if (!userEmail) {
          throw new Error('Could not get user email from Slack');
        }

        const dbUser = await db.query.user.findFirst({
          where: eq(user.email, userEmail)
        });

        if (!dbUser) {
          throw new Error('User not found in database');
        }

        await db.insert(slackWorkspaces).values({
          id: teamId,
          name: installation.team?.name || '',
          slackBotToken: installation.bot?.token,
          slackBotId: installation.bot?.id || '',
          slackBotUserId: installation.bot?.userId || '',
          userId: dbUser.id,
          updatedAt: now
        }).onConflictDoUpdate({
          target: [slackWorkspaces.id],
          set: {
            name: installation.team?.name || '',
            slackBotToken: installation.bot?.token,
            slackBotId: installation.bot?.id || '',
            slackBotUserId: installation.bot?.userId || '',
            userId: dbUser.id,
            updatedAt: now
          }
        })

        if (installation.bot?.token) {
          try {
            const channelsResponse = await app.client.conversations.list({
              token: installation.bot.token,
              types: 'public_channel',
              exclude_archived: true
            })

            const defaultChannel = channelsResponse.channels?.find(
              channel => channel.name === 'general' || channel.name === 'random'
            )

            if (defaultChannel?.id) {
              try {
                await app.client.chat.postMessage({
                  token: installation.bot.token,
                  channel: defaultChannel.id,
                  text: '👋 Hello! I\'m the Triple Whale bot. Use `/connect` to connect your workspace to Triple Whale accounts, and then you can mention me in any channel to ask questions about your data!'
                })
              } catch (error) {
                console.error('Failed to send welcome message:', error)
              }
            }
          } catch (error) {
            console.error('Failed to find default channel:', error)
          }
        }
      } catch (error) {
        console.error('Failed to store installation:', error)
        throw error
      }
    },
    fetchInstallation: async (query) => {
      try {
        const result = await db.query.slackWorkspaces.findFirst({
          where: eq(slackWorkspaces.id, query.teamId || '')
        })

        if (!result) {
          throw new Error('No installation found')
        }

        if (!result.slackBotToken) {
          throw new Error('No bot token found')
        }

        return {
          team: { id: result.id || '', name: result.name || '' },
          enterprise: undefined,
          user: { token: undefined, id: '', scopes: [] },
          bot: {
            token: result.slackBotToken,
            userId: result.slackBotUserId || '',
            id: result.slackBotId || '',
            scopes: [
              'app_mentions:read',
              'channels:read',
              'channels:join',
              'chat:write',
              'commands',
              'groups:read',
              'im:history',
              'im:read',
              'im:write',
              'mpim:read',
              'mpim:write',
              'team:read',
              'users:read',
              'users:read.email'
            ]
          },
          tokenType: 'bot',
          isEnterpriseInstall: false,
          appId: process.env.SLACK_CLIENT_ID!
        }
      } catch (error) {
        console.error('Failed to fetch installation:', error)
        throw error
      }
    },
    deleteInstallation: async (query) => {
      try {
        const teamId = query.teamId || ''
        await db.delete(workspaceBrands).where(eq(workspaceBrands.workspaceId, teamId))
        await db.delete(slackWorkspaces).where(eq(slackWorkspaces.id, teamId))
      } catch (error) {
        console.error('Failed to delete installation:', error)
        throw error
      }
    }
  },
  installerOptions: {
    directInstall: true,
    callbackOptions: {
      success: (installation, installOptions, req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <body>
              <h1>Successfully connected!</h1>
              <p>You can close this window and return to Slack. All members in your workspace can now use the app.</p>
              <script>
                setTimeout(() => window.close(), 3000);
              </script>
            </body>
          </html>
        `)
      },
      failure: (error, installOptions, req, res) => {
        console.error('OAuth installation failed:', error)
        res.writeHead(500, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <body>
              <h1>Installation Failed</h1>
              <p>Sorry, something went wrong during the installation. Please try again.</p>
            </body>
          </html>
        `)
      }
    }
  }
})

// app.command('/connect', async ({ command, ack, respond }) => {
//   await ack()

//   try {
//     const uniqueAccountId = `lilosocial_${command.team_id}`

//     try {
//       const registrationResponse = await fetch('https://api.triplewhale.com/api/v2/orcabase/dev/register-account', {
//         method: 'POST',
//         headers: {
//           'accept': 'application/json',
//           'content-type': 'application/json',
//           'x-api-key': process.env.ORCABASE_API_KEY!
//         },
//         body: JSON.stringify({
//           appId: process.env.TRIPLEWHALE_CLIENT_ID!,
//           accountId: uniqueAccountId,
//           accountName: command.team_domain || command.team_id,
//           timezone: 'America/New_York',
//           currency: 'USD'
//         })
//       })

//       if (registrationResponse.ok) {
//         const registrationData = await registrationResponse.json()
//       }
//     } catch (error) {
//       console.log('Triple Whale registration error (might be already registered):', error)
//     }

//     const params = new URLSearchParams({
//       client_id: process.env.TRIPLEWHALE_CLIENT_ID!,
//       redirect_uri: process.env.REDIRECT_URI!,
//       response_type: 'code',
//       scope: 'offline_access offline',
//       state: `slack_team_${command.team_id}`,
//       account_id: uniqueAccountId
//     })

//     const authUrl = `https://api.triplewhale.com/api/v2/orcabase/dev/auth?${params.toString()}`

//     await respond({
//       text: `Click this link to connect a new Triple Whale account to your workspace:\n${authUrl}\n\nThis account will be available to the entire workspace.`
//     })
//   } catch (error) {
//     console.error('Error in connect flow:', error)
//     await respond({
//       text: 'Sorry, something went wrong. Please try again.'
//     })
//   }
// })

// app.command('/integrations', async ({ command, ack, respond }) => {
//   await ack()

//   try {
//     const connection = await db.select({
//       brandId: workspaceBrands.brandId,
//       accessToken: brands.tripleWhaleAccessToken
//     })
//       .from(workspaceBrands)
//       .innerJoin(brands, eq(workspaceBrands.brandId, brands.id))
//       .where(and(
//         eq(workspaceBrands.workspaceId, command.team_id),
//         eq(workspaceBrands.isDefault, 'true')
//       ))
//       .limit(1)
//       .then(results => results[0])

//     if (!connection?.accessToken) {
//       await respond({
//         text: 'Your workspace needs to connect to Triple Whale first. Use `/connect` to get started.'
//       })
//       return
//     }

//     const tripleWhaleAccessToken = await TripleWhaleClient.getValidAccessToken(connection.brandId)

//     const integrationsUrl = await TripleWhaleClient.getIntegrationsUrl(connection.brandId)

//     await respond({
//       text: `Click here to manage your workspace's Triple Whale integrations:\n${integrationsUrl}`
//     })
//   } catch (error) {
//     if (error instanceof Error && error.message === 'Refresh token expired. User needs to reauthenticate.') {
//       await respond({
//         text: 'Your workspace\'s Triple Whale connection has expired. Please use `/connect` to reconnect.'
//       })
//       return
//     }
//     console.error('Error getting integrations URL:', error)
//     await respond({
//       text: 'Sorry, something went wrong. Please try again.'
//     })
//   }
// })

// app.command('/manage-connections', async ({ command, ack, respond }) => {
//   await ack()

//   try {
//     const connections = await db.select({
//       brandId: workspaceBrands.brandId,
//       name: brands.name
//     })
//       .from(workspaceBrands)
//       .innerJoin(brands, eq(workspaceBrands.brandId, brands.id))
//       .where(eq(workspaceBrands.workspaceId, command.team_id))

//     if (connections.length === 0) {
//       await respond({
//         text: 'No Triple Whale accounts connected. Use `/connect` to connect an account.'
//       })
//       return
//     }

//     const connectionList = connections.map((conn, i) =>
//       `${i + 1}. ${conn.name}`
//     ).join('\n')

//     await respond({
//       text: `Connected Triple Whale accounts:\n${connectionList}\n\nUse \`/set-default-account [number]\` to set the default account.`
//     })
//   } catch (error) {
//     console.error('Error listing connections:', error)
//     await respond({
//       text: 'Sorry, something went wrong. Please try again.'
//     })
//   }
// })

// app.command('/set-default-account', async ({ command, ack, respond }) => {
//   await ack()

//   try {
//     const accountNumber = parseInt(command.text)
//     if (isNaN(accountNumber)) {
//       await respond({
//         text: 'Please provide a valid account number. Use `/manage-connections` to see the list of accounts.'
//       })
//       return
//     }

//     const connections = await db.query.workspaceBrands.findMany({
//       where: eq(workspaceBrands.workspaceId, command.team_id)
//     })

//     if (accountNumber < 1 || accountNumber > connections.length) {
//       await respond({
//         text: 'Invalid account number. Use `/manage-connections` to see the list of accounts.'
//       })
//       return
//     }

//     const selectedConnection = connections[accountNumber - 1]

//     await db.update(workspaceBrands)
//       .set({ isDefault: 'false' })
//       .where(eq(workspaceBrands.workspaceId, command.team_id))

//     await db.update(workspaceBrands)
//       .set({ isDefault: 'true' })
//       .where(and(
//         eq(workspaceBrands.workspaceId, command.team_id),
//         eq(workspaceBrands.brandId, selectedConnection.brandId)
//       ))

//     await respond({
//       text: 'Default account updated successfully.'
//     })
//   } catch (error) {
//     console.error('Error setting default account:', error)
//     await respond({
//       text: 'Sorry, something went wrong. Please try again.'
//     })
//   }
// })

app.command('/select-brand', async ({ command, ack, respond }) => {
  await ack();

  try {
    const workspace = await db.query.slackWorkspaces.findFirst({
      where: eq(slackWorkspaces.id, command.team_id),
    });

    if (!workspace) {
      await respond({ text: 'Workspace not found. Please reinstall the app.', response_type: 'ephemeral' });
      return;
    }

    const userBrands = await db.query.brands.findMany({
      where: eq(brands.userId, workspace.userId!),
    });

    if (userBrands.length === 0) {
      await respond({ text: 'No brands found. Please connect some brands first.', response_type: 'ephemeral' });
      return;
    }

    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Select a brand to use for queries:*'
          }
        },
        {
          type: 'actions',
          block_id: 'brand_selection',
          elements: [
            {
              type: 'static_select',
              action_id: 'select_brand',
              placeholder: {
                type: 'plain_text',
                text: 'Select a brand'
              },
              options: userBrands.map(brand => ({
                text: {
                  type: 'plain_text',
                  text: brand.name
                },
                value: brand.id
              }))
            }
          ]
        }
      ]
    });
  } catch (error) {
    console.error('Error in select-brand command:', error);
    await respond({ text: 'An error occurred while fetching brands.', response_type: 'ephemeral' });
  }
});

app.action('select_brand', async ({ ack, body, respond }) => {
  await ack();

  type BlockActionBody = {
    actions: Array<{ selected_option?: { value: string } }>;
    team?: { id: string };
  };

  const actionBody = body as BlockActionBody;
  const action = actionBody.actions[0];

  if (!action?.selected_option?.value) {
    await respond('Invalid selection');
    return;
  }

  const selectedBrandId = action.selected_option.value;
  const teamId = actionBody.team?.id;

  if (!teamId) {
    await respond('Team ID not found');
    return;
  }

  try {
    const workspace = await db.query.slackWorkspaces.findFirst({
      where: eq(slackWorkspaces.id, teamId),
    });

    if (!workspace) {
      await respond('Workspace not found');
      return;
    }

    await db.insert(workspaceBrands).values({
      workspaceId: teamId,
      brandId: selectedBrandId,
      isDefault: 'true',
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [workspaceBrands.workspaceId, workspaceBrands.brandId],
      set: {
        isDefault: 'true',
        updatedAt: new Date()
      }
    });

    await db.update(workspaceBrands)
      .set({ isDefault: 'false' })
      .where(
        and(
          eq(workspaceBrands.workspaceId, teamId),
          ne(workspaceBrands.brandId, selectedBrandId)
        )
      );

    const brand = await db.query.brands.findFirst({
      where: eq(brands.id, selectedBrandId)
    });

    await respond(`Successfully set ${brand?.name} as the default brand for queries!`);
  } catch (error) {
    console.error('Error setting default brand:', error);
    await respond('An error occurred while setting the default brand.');
  }
});

app.event('app_mention', async ({ event, client, say }) => {
  const messageText = event.text.replace(/<@[^>]+>/, '').trim()

  try {
    if (!messageText) {
      await say({
        text: `Hey <@${event.user}>! 👋 Just mention me with your question about your ads data!`
      })
      return
    }

    const teamId = event.team
    if (!teamId) {
      throw new Error('Could not determine team ID')
    }

    const workspace = await db.query.slackWorkspaces.findFirst({
      where: eq(slackWorkspaces.id, teamId),
    });

    if (!workspace) {
      await say('Workspace not found. Please reinstall the app.');
      return;
    }

    const userBrands = await db.query.brands.findMany({
      where: eq(brands.userId, workspace.userId!),
    });

    if (userBrands.length === 0) {
      await say('No brands found. Please connect some brands first.');
      return;
    }

    await say({
      thread_ts: event.ts,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Select a brand to run your query:*'
          }
        },
        {
          type: 'actions',
          block_id: 'brand_selection',
          elements: [
            {
              type: 'static_select',
              action_id: 'run_query_with_brand',
              placeholder: {
                type: 'plain_text',
                text: 'Select a brand'
              },
              options: userBrands.map(brand => ({
                text: {
                  type: 'plain_text',
                  text: brand.name
                },
                value: `${brand.id}|||${messageText}`
              }))
            }
          ]
        }
      ]
    });
  } catch (error) {
    console.error('Error in app_mention handler:', error)
    await say({
      text: 'Sorry, something went wrong. Please try again.',
      thread_ts: event.thread_ts || event.ts
    })
  }
})

app.action('run_query_with_brand', async ({ ack, body, client }) => {
  await ack();

  const action = (body as any).actions[0];
  const teamId = (body as any).team?.id;

  if (!action?.selected_option?.value || !teamId) {
    await client.chat.postMessage({
      channel: (body as any).channel.id,
      text: 'Invalid selection'
    });
    return;
  }

  const [selectedBrandId, queryText] = action.selected_option.value.split('|||');

  try {
    // Set as default brand
    await db.insert(workspaceBrands).values({
      workspaceId: teamId,
      brandId: selectedBrandId,
      isDefault: 'true',
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [workspaceBrands.workspaceId, workspaceBrands.brandId],
      set: {
        isDefault: 'true',
        updatedAt: new Date()
      }
    });

    await db.update(workspaceBrands)
      .set({ isDefault: 'false' })
      .where(
        and(
          eq(workspaceBrands.workspaceId, teamId),
          ne(workspaceBrands.brandId, selectedBrandId)
        )
      );

    // Get brand info
    const brand = await db.query.brands.findFirst({
      where: eq(brands.id, selectedBrandId)
    });

    await client.chat.update({
      channel: (body as any).channel.id,
      ts: (body as any).message.ts,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Running query for brand: ${brand?.name}*`
          }
        }
      ]
    });

    const loadingMessage = await client.chat.postMessage({
      channel: (body as any).channel.id,
      text: '🔍 Searching for data...',
      thread_ts: (body as any).message.thread_ts || (body as any).message.ts
    });

    const tripleWhaleAccessToken = await TripleWhaleClient.getValidAccessToken(selectedBrandId);

    const response = await fetch('https://api.triplewhale.com/api/v2/orcabase/api/moby', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tripleWhaleAccessToken}`,
      },
      body: JSON.stringify({
        question: queryText + " do not output into a visualization, give me the data in text form",
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to query Moby AI: ${response.statusText}`);
    }

    const result = await response.json();
    let messages: string[] = [];
    let debugMessages: string[] = [];

    if (result.isError) {
      messages.push(`Error: ${result.error || 'An unknown error occurred'}`);
    } else {
      if (result.assistantConclusion) {
        let formattedConclusion = formatMessage(result.assistantConclusion);
        if (formattedConclusion) {
          messages.push(formattedConclusion);
        }
      }

      if (result.responses && Array.isArray(result.responses)) {
        for (const resp of result.responses) {
          if (resp.assistant) {
            let formattedResponse = formatMessage(resp.assistant);
            if (formattedResponse) {
              debugMessages.push(formattedResponse);
            }
          }
        }
      }

      if (messages.length === 0 && debugMessages.length === 0) {
        messages.push('Error: No response received from Triple Whale');
      }
    }

    await client.chat.update({
      channel: (body as any).channel.id,
      ts: loadingMessage.ts!,
      text: `📊 Here is your Triple Whale data for ${brand?.name}:`
    });

    const MAX_MESSAGE_LENGTH = 3500;
    const messageChunks = [];

    let fullMessage = messages.join('\n\n').trim();

    if (debugMessages.length > 0) {
      fullMessage += '\n\n*Debug Information:*\n' + debugMessages.join('\n\n');
    }

    fullMessage = fullMessage.replace(/\n{3,}/g, '\n\n').trim();

    for (let i = 0; i < fullMessage.length; i += MAX_MESSAGE_LENGTH) {
      messageChunks.push(fullMessage.slice(i, i + MAX_MESSAGE_LENGTH));
    }

    for (const chunk of messageChunks) {
      await client.chat.postMessage({
        channel: (body as any).channel.id,
        text: chunk,
        thread_ts: (body as any).message.thread_ts || (body as any).message.ts,
        mrkdwn: true
      });
    }

  } catch (error) {
    console.error('Error processing query with brand:', error);
    const errorMessage = error instanceof Error && error.message === 'Refresh token expired. User needs to reauthenticate.'
      ? 'Your Triple Whale connection has expired. Please use `/connect` to reconnect.'
      : 'Sorry, something went wrong. Please try again.';

    await client.chat.postMessage({
      channel: (body as any).channel.id,
      text: errorMessage,
      thread_ts: (body as any).message.thread_ts || (body as any).message.ts
    });
  }
});

const port = process.env.PORT || 3000
  ; (async () => {
    await app.start(port)
    console.log(`⚡️ Bolt app is running on port ${port}!`)
  })()

export default app
