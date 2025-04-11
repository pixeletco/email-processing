import 'aws-sdk-client-mock-jest'

import { mockClient } from 'aws-sdk-client-mock'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { Callback, Context, S3Event } from 'aws-lambda'

import { handler } from '../lambda/handle-s3-events'

const sqsClient = mockClient(SQSClient)
const dummyContext = {} as Context
const dummyCallback: Callback<void> = () => {}

beforeEach(() => {
  sqsClient.reset()
})

test('Lambda sends SQS message on S3 event', async () => {
  sqsClient.on(SendMessageCommand).resolves({ MessageId: '12345' })

  process.env.QUEUE_URL =
    'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue'

  const event: S3Event = {
    Records: [
      {
        eventVersion: '2.1',
        eventSource: 'aws:s3',
        awsRegion: 'us-west-2',
        eventTime: '1970-01-01T00:00:00.000Z',
        eventName: 'ObjectCreated:Put',
        userIdentity: {
          principalId: 'EXAMPLE',
        },
        requestParameters: {
          sourceIPAddress: '127.0.0.1',
        },
        responseElements: {
          'x-amz-request-id': 'C3D13FE58DE4C810',
          'x-amz-id-2':
            'FMyUVURIY8/IgAtTv8xRjskZQpcIZ9KG4V5Wp6S7S/JRWeUWerMUE5JgHvANOjpD',
        },
        s3: {
          s3SchemaVersion: '1.0',
          configurationId: 'testConfigRule',
          bucket: {
            name: 'amzn-s3-email-bucket',
            ownerIdentity: {
              principalId: 'A3NL1KOZZKExample',
            },
            arn: 'arn:aws:s3:::amzn-s3-email-bucket',
          },
          object: {
            key: 'example-key',
            size: 5,
            eTag: 'b1946ac92492d2347c6235b4d2611184',
            versionId: 'NX.DRp5klxcEVaJ5RC_fO0994Hl.JHOY',
            sequencer: '00617F08299329D189',
          },
        },
      },
    ],
  }

  await handler(event, dummyContext, dummyCallback)

  expect(sqsClient).toHaveReceivedCommandWith(SendMessageCommand, {
    QueueUrl: process.env.QUEUE_URL,
    MessageBody: expect.toIncludeMultiple([
      '"displayName":"App\\\\Jobs\\\\ProcessIncomingEmail"',
      '"job":"Illuminate\\\\Queue\\\\CallQueuedHandler@call"',
      '"commandName":"App\\\\Jobs\\\\ProcessIncomingEmail"',
      '"command":"O:29:\\"App\\\\Jobs\\\\ProcessIncomingEmail\\":1:{s:6:\\"object\\";s:11:\\"example-key\\";}"',
    ]),
  })
})
