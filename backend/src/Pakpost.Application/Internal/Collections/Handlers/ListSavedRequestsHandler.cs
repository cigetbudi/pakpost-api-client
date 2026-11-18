using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Queries;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class ListSavedRequestsHandler(IWorkspaceRepository workspaces, ICollectionRepository collections, ISavedRequestRepository requests)
    : IRequestHandler<ListSavedRequestsQuery, IReadOnlyList<SavedRequestDto>>
{
    public async ValueTask<IReadOnlyList<SavedRequestDto>> Handle(ListSavedRequestsQuery q, CancellationToken ct)
    {
        await SavedRequestsAccess.Check(q.ActorId, q.WorkspaceId, q.CollectionId, workspaces, collections, ct);
        return (await requests.ListAsync(q.CollectionId, ct)).Select(SavedRequestsAccess.ToDto).ToArray();
    }
}
