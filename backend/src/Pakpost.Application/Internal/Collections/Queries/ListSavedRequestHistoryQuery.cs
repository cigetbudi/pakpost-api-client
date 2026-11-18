using System.Text.Json;
using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Queries;

public sealed record ListSavedRequestHistoryQuery(
    Guid ActorId,
    Guid WorkspaceId,
    Guid CollectionId,
    Guid RequestId
) : IRequest<IReadOnlyList<SavedRequestHistoryItemDto>>;
