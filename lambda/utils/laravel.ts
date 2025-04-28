export interface Payload {
  uuid: string
  displayName: string
  job: string
  maxTries: null
  maxExceptions: null
  failOnTimeout: boolean
  backoff: null
  timeout: null
  retryUntil: null
  data: {
    commandName: string
    command: string
  }
  createdAt: number
}

export class ProcessIncomingEmail {
  object: string

  constructor(object: string) {
    this.object = object
  }
}
