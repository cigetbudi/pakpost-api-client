using System.Text.Json;
using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record MoveSavedRequestCommand(
    Guid ActorId,
    Guid WorkspaceId,
    Guid CollectionId,
    Guid RequestId,
    Guid TargetCollectionId,
    Guid? TargetFolderId = null
) : IRequest<SavedRequestDto>;
