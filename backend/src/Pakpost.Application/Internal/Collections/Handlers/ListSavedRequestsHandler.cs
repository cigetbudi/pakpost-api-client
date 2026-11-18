using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed class ListSavedRequestsHandler(IWorkspaceRepository workspaces, ICollectionRepository collections, ISavedRequestRepository requests)
    : SavedRequestsAccess, IRequestHandler<ListSavedRequestsQuery, IReadOnlyList<SavedRequestDto>>
{
    public async ValueTask<IReadOnlyList<SavedRequestDto>> Handle(ListSavedRequestsQuery q, CancellationToken ct)
    {
        await Check(q.ActorId, q.WorkspaceId, q.CollectionId, workspaces, collections, ct);
        return (await requests.ListAsync(q.CollectionId, ct)).Select(ToDto).ToArray();
    }
}
