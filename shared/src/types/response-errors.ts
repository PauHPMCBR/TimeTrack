export type ErrorCode = 'MethodNotAllowed'
    | 'GetError'
    | 'PostError'
    | 'PutError'
    | 'DeleteError'
    | 'EntryNotFound'
    | 'InvalidCredentials'
    | 'AccountBlocked'
    | 'InvalidRegisterToken'
    | 'IncorrectParameter'
    | 'MissingParameter'
    | 'IllegalAction'
    | 'ValidationError'
    | 'NetworkError' // when frontend fails to get a proper backend response
    | 'TokenRequired'
    | 'InvalidToken'
    | 'InsufficientPermissions'
    | 'UserNotFound'
    | 'NoAccessToUser'
    | 'NoAccessToGroup'
    | 'PermissionVerificationError'
    | 'GroqApiKeyMissing'
    | 'MessageMissing'
    | 'AiError'
    | 'InternalError'
    | 'Success'
    | 'GroupDeleted'
    | 'CheckInRegistered'
    | 'CheckOutRegistered'
    | 'YearlyVacationSaved'
    ;

export type IncorrectParameter = 'email' | 'password' | 'year' | 'month' | 'type' | 'userId' | 'obligatoryDays' | 'status';

export type PasswordIncorrectParameterReason = 'LessThan12Characters'
    | 'MissingLowercase'
    | 'MissingUppercase'
    | 'MissingNumber'
    | 'MissingSign'
    | 'ContainsEmail'
    | 'ContainsUsername';

export type CheckInIncorrectParameterReason = 'AlreadyCheckedIn'
    | 'AlreadyCheckedOut'
    | 'NoEntryToday';

export type EmailIncorrectParameterReason = 'AlreadyExists'

export type IncorrectParameterReason = PasswordIncorrectParameterReason 
    | CheckInIncorrectParameterReason
    | EmailIncorrectParameterReason
    | 'ShouldNotBeSet' | 'DatesNotInYear'; // TODO translation

export type IllegalAction = 'DuplicateVacationRequest'
    | 'AllVacationsUsed'
    | 'AlreadyObligatoryVacation'
    | 'ModifyingFromAnotherUser'; // TODO translations