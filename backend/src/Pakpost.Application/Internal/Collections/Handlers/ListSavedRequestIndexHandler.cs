using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Queries;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class ListSavedRequestIndexHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ISavedRequestRepository requests)
    : IRequestHandler<ListSavedRequestIndexQuery, IReadOnlyList<SavedRequestIndexDto>>
{
    public async ValueTask<IReadOnlyList<SavedRequestIndexDto>> Handle(ListSavedRequestIndexQuery query, CancellationToken ct)
    {
        await SavedRequestsAccess.Check(query.ActorId, query.WorkspaceId, query.CollectionId, workspaces, collections, ct);
        var items = await requests.ListIndexAsync(query.CollectionId, ct);

        return items.Select(item => new SavedRequestIndexDto(
            item.Id,
            item.CollectionId,
            item.Name,
            item.Method,
            item.Url,
            SavedHeaderPolicy.RedactLegacyCredentials(item.HeadersJson),
            item.Revision,
            item.FolderId)).ToArray();
    }
}
