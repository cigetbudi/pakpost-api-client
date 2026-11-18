using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed class ListSavedRequestHistoryHandler(IWorkspaceRepository workspaces, ICollectionRepository collections,
    ISavedRequestRepository requests, ISavedRequestRevisionRepository history)
    : SavedRequestHistoryAccess, IRequestHandler<ListSavedRequestHistoryQuery, IReadOnlyList<SavedRequestHistoryItemDto>>
{
    public async ValueTask<IReadOnlyList<SavedRequestHistoryItemDto>> Handle(ListSavedRequestHistoryQuery q, CancellationToken ct)
    {
        await Check(q.ActorId, q.WorkspaceId, q.CollectionId, q.RequestId, false, workspaces, collections, requests, ct);
        return (await history.ListAsync(q.RequestId, 50, ct))
        .Select(x => new SavedRequestHistoryItemDto(x.Revision, x.Action, x.ActorId, x.CreatedAt)).ToArray();
    }
}
