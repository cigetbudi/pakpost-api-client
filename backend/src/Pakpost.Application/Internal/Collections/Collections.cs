using FluentValidation;
using MediatR;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;
public sealed record CollectionDto(Guid Id, Guid WorkspaceId, string Name);
public sealed record ListCollectionsQuery(Guid ActorId, Guid WorkspaceId) : IRequest<IReadOnlyList<CollectionDto>>;
public sealed class ListCollectionsHandler(ICollectionRepository collections, IWorkspaceRepository workspaces)
    : IRequestHandler<ListCollectionsQuery, IReadOnlyList<CollectionDto>>
{
    public async Task<IReadOnlyList<CollectionDto>> Handle(ListCollectionsQuery query, CancellationToken ct)
    {
        if (await workspaces.FindMemberAsync(query.WorkspaceId, query.ActorId, ct) is null)
            throw AppException.Forbidden();
        return (await collections.ListAsync(query.WorkspaceId, ct))
            .Select(x => new CollectionDto(x.Id, x.WorkspaceId, x.Name)).ToArray();
    }
}
public sealed record CreateCollectionCommand(Guid ActorId, Guid WorkspaceId, string Name) : IRequest<CollectionDto>;
public sealed class CreateCollectionValidator : AbstractValidator<CreateCollectionCommand>
{
    public CreateCollectionValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
}
public sealed class CreateCollectionHandler(ICollectionRepository collections, IWorkspaceRepository workspaces, IUnitOfWork uow)
    : IRequestHandler<CreateCollectionCommand, CollectionDto>
{
    public async Task<CollectionDto> Handle(CreateCollectionCommand request, CancellationToken ct)
    {
        if (await workspaces.FindMemberAsync(request.WorkspaceId, request.ActorId, ct) is null)
            throw AppException.Forbidden();
        var col = new Collection(request.WorkspaceId, request.Name, request.ActorId);
        collections.Add(col);
        await uow.SaveChangesAsync(ct);
        return new(col.Id, col.WorkspaceId, col.Name);
    }
}

public sealed record RenameCollectionCommand(Guid ActorId,Guid WorkspaceId,Guid CollectionId,string Name):IRequest<CollectionDto>;
public sealed class RenameCollectionValidator:AbstractValidator<RenameCollectionCommand>
{
    public RenameCollectionValidator()=>RuleFor(x=>x.Name).NotEmpty().MaximumLength(120);
}
public sealed class RenameCollectionHandler(ICollectionRepository collections,IWorkspaceRepository workspaces,IUnitOfWork uow):IRequestHandler<RenameCollectionCommand,CollectionDto>
{
    public async Task<CollectionDto> Handle(RenameCollectionCommand cmd,CancellationToken ct)
    {
        if(await workspaces.FindMemberAsync(cmd.WorkspaceId,cmd.ActorId,ct) is null)throw AppException.Forbidden();
        var item=await collections.FindAsync(cmd.CollectionId,ct);
        if(item is null||item.WorkspaceId!=cmd.WorkspaceId)throw AppException.NotFound("Collection not found");
        item.Rename(cmd.Name);await uow.SaveChangesAsync(ct);
        return new(item.Id,item.WorkspaceId,item.Name);
    }
}
public sealed record DeleteCollectionCommand(Guid ActorId,Guid WorkspaceId,Guid CollectionId):IRequest;
public sealed class DeleteCollectionHandler(ICollectionRepository collections,IWorkspaceRepository workspaces,IUnitOfWork uow):IRequestHandler<DeleteCollectionCommand>
{
    public async Task Handle(DeleteCollectionCommand cmd,CancellationToken ct)
    {
        if(await workspaces.FindMemberAsync(cmd.WorkspaceId,cmd.ActorId,ct) is null)throw AppException.Forbidden();
        var item=await collections.FindAsync(cmd.CollectionId,ct);
        if(item is null||item.WorkspaceId!=cmd.WorkspaceId)throw AppException.NotFound("Collection not found");
        collections.Remove(item);await uow.SaveChangesAsync(ct);
    }
}
