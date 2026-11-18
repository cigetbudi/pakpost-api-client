using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record UpdateSavedRequestCommand(
    Guid ActorId,
    Guid WorkspaceId,
    Guid CollectionId,
    Guid RequestId,
    string Name,
    string Method,
    string Url,
    string HeadersJson,
    string Body,
    string BodyMode = "raw",
    string ContentType = "application/json",
    string FormFieldsJson = "[]",
    string PreRequestScript = "",
    string PostResponseScript = "",
    int? ExpectedRevision = null)
    : IRequest<SavedRequestDto>, ISavedRequestPayload;
