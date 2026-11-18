using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed class ListFoldersHandler(IWorkspaceRepository w, ICollectionRepository c, ICollectionFolderRepository folders)
    : IRequestHandler<ListFoldersQuery, IReadOnlyList<FolderDto>>
{
    public async ValueTask<IReadOnlyList<FolderDto>> Handle(ListFoldersQuery q, CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(q.ActorId, q.WorkspaceId, q.CollectionId, false, w, c, ct);
        return (await folders.ListAsync(q.CollectionId, ct)).Select(CloudFolderRules.ToDto).ToArray();
    }
}
