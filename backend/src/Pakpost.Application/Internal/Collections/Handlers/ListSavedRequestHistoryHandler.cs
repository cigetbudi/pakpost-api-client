using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Queries;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class ListSavedRequestHistoryHandler(IWorkspaceRepository workspaces, ICollectionRepository collections,
    ISavedRequestRepository requests, ISavedRequestRevisionRepository history)
    : IRequestHandler<ListSavedRequestHistoryQuery, IReadOnlyList<SavedRequestHistoryItemDto>>
{
    public async ValueTask<IReadOnlyList<SavedRequestHistoryItemDto>> Handle(ListSavedRequestHistoryQuery q, CancellationToken ct)
    {
        await SavedRequestsAccess.Check(q.ActorId, q.WorkspaceId, q.CollectionId, workspaces, collections, ct);
        if (!await requests.ExistsInCollectionAsync(q.RequestId, q.CollectionId, ct))
        {
            throw AppException.NotFound("Saved request not found");
        }

        return (await history.ListOverviewAsync(q.RequestId, 50, ct))
            .Select(x => new SavedRequestHistoryItemDto(x.Revision, x.Action, x.ActorId, x.CreatedAt))
            .ToArray();
    }
}
