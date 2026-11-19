using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Queries;

public sealed record ListSavedRequestIndexQuery(Guid ActorId, Guid WorkspaceId, Guid CollectionId)
    : IRequest<IReadOnlyList<SavedRequestIndexDto>>;
