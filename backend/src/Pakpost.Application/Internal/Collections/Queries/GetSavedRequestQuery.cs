using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Queries;

public sealed record GetSavedRequestQuery(Guid ActorId, Guid WorkspaceId, Guid CollectionId, Guid RequestId)
    : IRequest<SavedRequestDto>;
