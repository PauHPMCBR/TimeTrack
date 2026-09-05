export type ErrorCode =
    | 'MethodNotAllowed'
    | 'GetError'
    | 'PostError'
    | 'PutError'
    | 'DeleteError'
    | 'EntryNotFound'
    | 'InvalidCredentials'
    | 'AccountBlocked'
    | 'InvalidRegisterToken'
    | 'InvalidResetToken'
    | 'ResetTokenExpired'
    | 'IncorrectParameter'
    | 'MissingParameter'
    | 'IllegalAction'
    | 'ValidationError'
    | 'NetworkError' // when frontend fails to get a proper backend response
    | 'NetworkTimeout' // when the request takes longer than expected
    | 'TokenRequired'
    | 'InvalidToken'
    | 'InsufficientPermissions'
    | 'UserNotFound'
    | 'GroupNotFound'
    | 'NoAccessToUser'
    | 'NoAccessToGroup'
    | 'PermissionVerificationError'
    | 'InternalError'
    | 'GroupDeleted'
    | 'CheckInRegistered'
    | 'CheckOutRegistered'
    | 'YearlyVacationSaved'
    | 'RateLimited';

export type IncorrectParameter =
    | 'email'
    | 'password'
    | 'year'
    | 'month'
    | 'type'
    | 'userId'
    | 'obligatoryDays'
    | 'status'
    | 'members'
    | 'avatar'
    | 'dni'
    | 'expectedWorkHours'
    | 'fromYear'
    | 'toYear'
    | 'timestamp'
    | 'date'
    | 'role'
    | 'currentPassword'
    | 'timezone'
    | 'trackingStartDate';

export type PasswordIncorrectParameterReason =
    | 'TooShort'
    | 'TooLong'
    | 'MissingLowercase'
    | 'MissingUppercase'
    | 'MissingNumber'
    | 'MissingSign'
    | 'ContainsEmail'
    | 'ContainsUsername';

export type CheckInIncorrectParameterReason =
    'AlreadyCheckedIn' | 'AlreadyCheckedOut' | 'NoEntryToday';

export type EmailIncorrectParameterReason = 'AlreadyExists';

export type IncorrectParameterReason =
    | PasswordIncorrectParameterReason
    | CheckInIncorrectParameterReason
    | EmailIncorrectParameterReason
    | 'ShouldNotBeSet'
    | 'DatesNotInYear'
    | 'SomeUsersNotFound'
    | 'AvatarTooLarge'
    | 'InvalidAvatarFormat'
    | 'NotInOrder'
    | 'OutOfDay'
    | 'InvalidTimestamp'
    | 'CannotDemoteAdmin'
    | 'CannotDeleteAdmin'
    | 'CannotDeleteSelf'
    | 'AlreadyDeleted'
    | 'NotDeleted'
    | 'CurrentPasswordRequired'
    | 'InvalidCurrentPassword'
    | 'InvalidTimezone';

export type IllegalAction =
    | 'DuplicateVacationRequest'
    | 'AllVacationsUsed'
    | 'AlreadyObligatoryVacation'
    | 'ModifyingFromAnotherUser'
    | 'NoVacationConfig'
    | 'FutureDate'
    // Monthly record confirmation
    | 'MonthNotPast'
    | 'MonthStillHasAnomalies'
    | 'MonthAlreadyApproved'
    | 'MonthNotOpen'
    | 'MonthApprovedLocked';
