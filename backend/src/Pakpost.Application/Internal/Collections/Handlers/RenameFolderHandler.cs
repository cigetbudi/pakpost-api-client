using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class RenameFolderHandler(IWorkspaceRepository w, ICollectionRepository c, ICollectionFolderRepository folders, IUnitOfWork uow)
    : IRequestHandler<RenameFolderCommand, FolderDto>
{
    public async ValueTask<FolderDto> Handle(RenameFolderCommand q, CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(q.ActorId, q.WorkspaceId, q.CollectionId, true, w, c, ct);
        var f = await folders.FindAsync(q.FolderId, ct);
        if (f is null || f.CollectionId != q.CollectionId)
            throw AppException.NotFound("Folder not found");
        if (q.ExpectedVersion <= 0 || f.Version != q.ExpectedVersion)
            throw AppException.Conflict("Folder changed: reload first");
        CloudFolderRules.ValidatePlacement(await folders.ListAsync(q.CollectionId, ct), q.CollectionId, f.ParentFolderId, q.Name, f.Id);
        f.Rename(q.Name);
        await uow.SaveChangesAsync(ct);
        return CloudFolderRules.ToDto(f);
    }
}
