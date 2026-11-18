using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed class CreateFolderHandler(IWorkspaceRepository w, ICollectionRepository c, ICollectionFolderRepository folders, IUnitOfWork uow)
    : IRequestHandler<CreateFolderCommand, FolderDto>
{
    public async ValueTask<FolderDto> Handle(CreateFolderCommand q, CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(q.ActorId, q.WorkspaceId, q.CollectionId, true, w, c, ct);
        CloudFolderRules.ValidatePlacement(await folders.ListAsync(q.CollectionId, ct), q.CollectionId, q.ParentFolderId, q.Name);
        var f = new CollectionFolder(q.CollectionId, q.ParentFolderId, q.Name);
        folders.Add(f);
        await uow.SaveChangesAsync(ct);
        return CloudFolderRules.ToDto(f);
    }
}
