using System.Text.Json;
using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record SaveRequestCommand(
    Guid ActorId,
    Guid WorkspaceId,
    Guid CollectionId,
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
    Guid? FolderId = null
) : IRequest<SavedRequestDto>;
