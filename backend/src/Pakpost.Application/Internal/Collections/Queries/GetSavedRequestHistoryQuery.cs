using System.Text.Json;
using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Queries;

public sealed record GetSavedRequestHistoryQuery(
    Guid ActorId,
    Guid WorkspaceId,
    Guid CollectionId,
    Guid RequestId,
    int Revision
) : IRequest<SavedRequestHistoryDetailDto>;
