using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Queries;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class ListFoldersHandler(IWorkspaceRepository w, ICollectionRepository c, ICollectionFolderRepository folders)
    : IRequestHandler<ListFoldersQuery, IReadOnlyList<FolderDto>>
{
    public async ValueTask<IReadOnlyList<FolderDto>> Handle(ListFoldersQuery q, CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(q.ActorId, q.WorkspaceId, q.CollectionId, false, w, c, ct);
        return (await folders.ListAsync(q.CollectionId, ct)).Select(CloudFolderRules.ToDto).ToArray();
    }
}
