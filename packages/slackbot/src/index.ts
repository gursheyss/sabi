import { App } from '@slack/bolt'
import { TripleWhaleClient } from './lib/triplewhale'
import { eq, and } from 'drizzle-orm'
import { URLSearchParams } from 'url'
import db from '@lighthouse/database'
import { tripleWhaleAccounts, workspaceConnections, slackWorkspaces } from '@lighthouse/database/src/schema'

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
    'users:read.email'
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

          const teamId = state?.replace('slack_team_', '')
          const accountId = `lilosocial_${teamId}`

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

          if (teamId) {
            const now = new Date()
            await db.insert(tripleWhaleAccounts).values({
              id: accountId,
              name: `Triple Whale Account - ${teamId}`,
              tripleWhaleAccessToken: tokens.access_token,
              tripleWhaleRefreshToken: tokens.refresh_token,
              tripleWhaleAccessTokenExpiresAt: new Date(now.getTime() + tokens.expires_in * 1000),
              tripleWhaleRefreshTokenExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
              updatedAt: now
            }).onConflictDoUpdate({
              target: [tripleWhaleAccounts.id],
              set: {
                tripleWhaleAccessToken: tokens.access_token,
                tripleWhaleRefreshToken: tokens.refresh_token,
                tripleWhaleAccessTokenExpiresAt: new Date(now.getTime() + tokens.expires_in * 1000),
                tripleWhaleRefreshTokenExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                updatedAt: now
              }
            })

            await db.insert(workspaceConnections).values({
              slackWorkspaceId: teamId,
              tripleWhaleAccountId: accountId,
              isDefault: 'true',
              createdAt: now,
              updatedAt: now
            }).onConflictDoUpdate({
              target: [workspaceConnections.slackWorkspaceId, workspaceConnections.tripleWhaleAccountId],
              set: {
                updatedAt: now
              }
            })
          }

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
        } catch (error) {
          console.error('Error in OAuth callback:', error)
          res.writeHead(500)
          res.end('Installation failed')
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

        await db.insert(slackWorkspaces).values({
          id: teamId,
          name: installation.team?.name || '',
          slackBotToken: installation.bot?.token,
          slackBotId: installation.bot?.id || '',
          slackBotUserId: installation.bot?.userId || '',
          updatedAt: now
        }).onConflictDoUpdate({
          target: [slackWorkspaces.id],
          set: {
            name: installation.team?.name || '',
            slackBotToken: installation.bot?.token,
            slackBotId: installation.bot?.id || '',
            slackBotUserId: installation.bot?.userId || '',
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
        await db.delete(workspaceConnections).where(eq(workspaceConnections.slackWorkspaceId, teamId))
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

app.command('/connect', async ({ command, ack, respond }) => {
  await ack()

  try {
    const uniqueAccountId = `lilosocial_${command.team_id}`

    try {
      const registrationResponse = await fetch('https://api.triplewhale.com/api/v2/orcabase/dev/register-account', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-api-key': process.env.ORCABASE_API_KEY!
        },
        body: JSON.stringify({
          appId: process.env.TRIPLEWHALE_CLIENT_ID!,
          accountId: uniqueAccountId,
          accountName: command.team_domain || command.team_id,
          timezone: 'America/New_York',
          currency: 'USD'
        })
      })

      if (registrationResponse.ok) {
        const registrationData = await registrationResponse.json()
      }
    } catch (error) {
      console.log('Triple Whale registration error (might be already registered):', error)
    }

    const params = new URLSearchParams({
      client_id: process.env.TRIPLEWHALE_CLIENT_ID!,
      redirect_uri: process.env.REDIRECT_URI!,
      response_type: 'code',
      scope: 'offline_access offline',
      state: `slack_team_${command.team_id}`,
      account_id: uniqueAccountId
    })

    const authUrl = `https://api.triplewhale.com/api/v2/orcabase/dev/auth?${params.toString()}`

    await respond({
      text: `Click this link to connect a new Triple Whale account to your workspace:\n${authUrl}\n\nThis account will be available to the entire workspace.`,
      response_type: 'ephemeral'
    })
  } catch (error) {
    console.error('Error in connect flow:', error)
    await respond({
      text: 'Sorry, something went wrong. Please try again.',
      response_type: 'ephemeral'
    })
  }
})

app.command('/integrations', async ({ command, ack, respond }) => {
  await ack()

  try {
    const connection = await db.select({
      accountId: workspaceConnections.tripleWhaleAccountId,
      accessToken: tripleWhaleAccounts.tripleWhaleAccessToken
    })
      .from(workspaceConnections)
      .innerJoin(tripleWhaleAccounts, eq(workspaceConnections.tripleWhaleAccountId, tripleWhaleAccounts.id))
      .where(and(
        eq(workspaceConnections.slackWorkspaceId, command.team_id),
        eq(workspaceConnections.isDefault, 'true')
      ))
      .limit(1)
      .then(results => results[0])

    if (!connection?.accessToken) {
      await respond({
        text: 'Your workspace needs to connect to Triple Whale first. Use `/connect` to get started.',
        response_type: 'ephemeral'
      })
      return
    }

    const accountId = connection.accountId

    const integrationsUrl = await TripleWhaleClient.getIntegrationsUrl(accountId)

    await respond({
      text: `Click here to manage your workspace's Triple Whale integrations:\n${integrationsUrl}`,
      response_type: 'ephemeral'
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Refresh token expired. User needs to reauthenticate.') {
      await respond({
        text: 'Your workspace\'s Triple Whale connection has expired. Please use `/connect` to reconnect.',
        response_type: 'ephemeral'
      })
      return
    }
    console.error('Error getting integrations URL:', error)
    await respond({
      text: 'Sorry, something went wrong. Please try again.',
      response_type: 'ephemeral'
    })
  }
})

app.command('/manage-connections', async ({ command, ack, respond }) => {
  await ack()

  try {
    const connections = await db.select({
      id: workspaceConnections.tripleWhaleAccountId,
      name: tripleWhaleAccounts.name,
      isDefault: workspaceConnections.isDefault
    })
      .from(workspaceConnections)
      .innerJoin(tripleWhaleAccounts, eq(workspaceConnections.tripleWhaleAccountId, tripleWhaleAccounts.id))
      .where(eq(workspaceConnections.slackWorkspaceId, command.team_id))

    if (connections.length === 0) {
      await respond({
        text: 'No Triple Whale accounts connected. Use `/connect` to connect an account.',
        response_type: 'ephemeral'
      })
      return
    }

    const connectionList = connections.map((conn, i) =>
      `${i + 1}. ${conn.name} ${conn.isDefault === 'true' ? '(Default)' : ''}`
    ).join('\n')

    await respond({
      text: `Connected Triple Whale accounts:\n${connectionList}\n\nUse \`/set-default-account [number]\` to set the default account.`,
      response_type: 'ephemeral'
    })
  } catch (error) {
    console.error('Error listing connections:', error)
    await respond({
      text: 'Sorry, something went wrong. Please try again.',
      response_type: 'ephemeral'
    })
  }
})

app.command('/set-default-account', async ({ command, ack, respond }) => {
  await ack()

  try {
    const accountNumber = parseInt(command.text)
    if (isNaN(accountNumber)) {
      await respond({
        text: 'Please provide a valid account number. Use `/manage-connections` to see the list of accounts.',
        response_type: 'ephemeral'
      })
      return
    }

    const connections = await db.query.workspaceConnections.findMany({
      where: eq(workspaceConnections.slackWorkspaceId, command.team_id)
    })

    if (accountNumber < 1 || accountNumber > connections.length) {
      await respond({
        text: 'Invalid account number. Use `/manage-connections` to see the list of accounts.',
        response_type: 'ephemeral'
      })
      return
    }

    const selectedConnection = connections[accountNumber - 1]

    await db.update(workspaceConnections)
      .set({ isDefault: 'false' })
      .where(eq(workspaceConnections.slackWorkspaceId, command.team_id))

    await db.update(workspaceConnections)
      .set({ isDefault: 'true' })
      .where(and(
        eq(workspaceConnections.slackWorkspaceId, command.team_id),
        eq(workspaceConnections.tripleWhaleAccountId, selectedConnection.tripleWhaleAccountId)
      ))

    await respond({
      text: 'Default account updated successfully.',
      response_type: 'ephemeral'
    })
  } catch (error) {
    console.error('Error setting default account:', error)
    await respond({
      text: 'Sorry, something went wrong. Please try again.',
      response_type: 'ephemeral'
    })
  }
})

app.event('app_mention', async ({ event, client, say }) => {
  const messageText = event.text.replace(/<@[^>]+>/, '').trim()
  let loadingMessage: { ts: string } | undefined

  try {
    if (!messageText) {
      await say({
        text: `Hey <@${event.user}>! 👋 Use these commands to interact with Triple Whale:
• \`/connect\` - Connect a new Triple Whale account
• \`/manage-connections\` - List and manage your Triple Whale accounts
• \`/set-default-account\` - Set which account to use by default
• Or just ask me questions about your data like "How much did we spend on meta ads?"`,
        thread_ts: event.thread_ts || event.ts
      })
      return
    }

    loadingMessage = await say({
      text: "🔄 Processing your request... I'll have your answer in just a moment!",
      thread_ts: event.thread_ts || event.ts
    }) as { ts: string }

    const teamInfo = await client.team.info()
    const teamId = teamInfo.team?.id

    if (!teamId) {
      throw new Error('Could not determine team ID')
    }

    const connection = await db.select({
      accountId: workspaceConnections.tripleWhaleAccountId,
      accessToken: tripleWhaleAccounts.tripleWhaleAccessToken
    })
      .from(workspaceConnections)
      .innerJoin(tripleWhaleAccounts, eq(workspaceConnections.tripleWhaleAccountId, tripleWhaleAccounts.id))
      .where(and(
        eq(workspaceConnections.slackWorkspaceId, teamId),
        eq(workspaceConnections.isDefault, 'true')
      ))
      .limit(1)
      .then(results => results[0])

    if (!connection?.accessToken) {
      await client.chat.update({
        channel: event.channel,
        ts: loadingMessage.ts!,
        text: 'No default Triple Whale account set. Use `/connect` to connect an account and `/set-default-account` to set it as default.'
      })
      return
    }

    const tripleWhaleAccessToken = await TripleWhaleClient.getValidAccessToken(connection.accountId)

    const response = await fetch('https://api.triplewhale.com/api/v2/orcabase/api/moby', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tripleWhaleAccessToken}`,
      },
      body: JSON.stringify({ question: messageText })
    })

    if (!response.ok) {
      throw new Error(`Failed to query Moby AI: ${response.statusText}`)
    }

    const result = await response.json()
    let message: string

    if (result.isError) {
      message = `Error: ${result.error || 'An unknown error occurred'}`
    } else {
      message = '```' + JSON.stringify(result, null, 2) + '```'
    }

    await client.chat.update({
      channel: event.channel,
      ts: loadingMessage.ts!,
      text: message
    })
  } catch (error) {
    console.error('Error in app_mention handler:', error)

    const errorMessage = error instanceof Error && error.message === 'Refresh token expired. User needs to reauthenticate.'
      ? 'Your Triple Whale connection has expired. Please use `/connect` to reconnect.'
      : 'Sorry, something went wrong. Please try again.'

    try {
      if (loadingMessage?.ts) {
        await client.chat.update({
          channel: event.channel,
          ts: loadingMessage.ts,
          text: errorMessage
        })
      } else {
        throw new Error('No loading message to update')
      }
    } catch (updateError) {
      await say({
        text: errorMessage,
        thread_ts: event.thread_ts || event.ts
      })
    }
  }
})

const port = process.env.PORT || 3000
  ; (async () => {
    await app.start(port)
    console.log(`⚡️ Bolt app is running on port ${port}!`)
  })()

export default app
