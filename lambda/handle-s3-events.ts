import { randomUUID } from 'crypto'
import { S3Handler } from 'aws-lambda'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { serialize } from 'php-serialize'

import { type Payload, ProcessIncomingEmail } from './utils/laravel'

const sqsClient = new SQSClient()

export const handler: S3Handler = async (event): Promise<void> => {
  const queueUrl = process.env.QUEUE_URL as string

  console.log('Received S3 event:', JSON.stringify(event))

  for (const record of event.Records) {
    const { object } = record.s3

    const job = new ProcessIncomingEmail(object.key)

    const displayName = 'App\\Jobs\\' + job.constructor.name
    const command = serialize(job, {
      [displayName]: ProcessIncomingEmail,
    })

    const payload: Payload = {
      uuid: randomUUID(),
      displayName,
      job: 'Illuminate\\Queue\\CallQueuedHandler@call',
      maxTries: null,
      maxExceptions: null,
      failOnTimeout: false,
      backoff: null,
      timeout: null,
      retryUntil: null,
      data: {
        commandName: displayName,
        command,
      },
    }

    // Prepare the message to send to the SQS queue...
    const sqsMessageCommand = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(payload),
    })

    try {
      const result = await sqsClient.send(sqsMessageCommand)
      console.log(`Message sent to SQS with ID: ${result.MessageId}`)
    } catch (error) {
      console.error('Error sending message to SQS:', error)
    }
  }
}
