using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;
public sealed record WorkspaceDto(Guid Id, string Name, Guid OwnerUserId);
public sealed record CreateWorkspaceCommand(Guid ActorId, string Name) : IRequest<WorkspaceDto>;
public sealed class CreateWorkspaceValidator : AbstractValidator<CreateWorkspaceCommand>
{
    public CreateWorkspaceValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
}
public sealed class CreateWorkspaceHandler(IWorkspaceRepository workspaces, IUnitOfWork uow)
    : IRequestHandler<CreateWorkspaceCommand, WorkspaceDto>
{
    public async ValueTask<WorkspaceDto> Handle(CreateWorkspaceCommand request, CancellationToken ct)
    {
        var workspace = new Workspace(request.Name, request.ActorId);
        workspaces.Add(workspace);
        workspaces.AddMember(new WorkspaceMember(workspace.Id, request.ActorId, WorkspaceRole.Owner));
        await uow.SaveChangesAsync(ct);
        return new(workspace.Id, workspace.Name, workspace.OwnerUserId);
    }
}
public sealed record ListWorkspacesQuery(Guid ActorId) : IRequest<IReadOnlyList<WorkspaceDto>>;
public sealed class ListWorkspacesHandler(IWorkspaceRepository workspaces)
    : IRequestHandler<ListWorkspacesQuery, IReadOnlyList<WorkspaceDto>>
{
    public async ValueTask<IReadOnlyList<WorkspaceDto>> Handle(ListWorkspacesQuery request, CancellationToken ct)
        => (await workspaces.ListForUserAsync(request.ActorId, ct))
            .Select(x => new WorkspaceDto(x.Id, x.Name, x.OwnerUserId)).ToArray();
}

public sealed record MemberDto(Guid UserId, string Email, string DisplayName, WorkspaceRole Role);
public sealed record ListWorkspaceMembersQuery(Guid ActorId, Guid WorkspaceId) : IRequest<IReadOnlyList<MemberDto>>;
public sealed class ListWorkspaceMembersHandler(IWorkspaceRepository workspaces, IUserRepository users)
    : IRequestHandler<ListWorkspaceMembersQuery, IReadOnlyList<MemberDto>>
{
    public async ValueTask<IReadOnlyList<MemberDto>> Handle(ListWorkspaceMembersQuery query, CancellationToken ct)
    {
        if (await workspaces.FindMemberAsync(query.WorkspaceId, query.ActorId, ct) is null)
            throw AppException.Forbidden();
        var memberships = await workspaces.ListMembersAsync(query.WorkspaceId, ct);
        var result = new List<MemberDto>();
        foreach (var m in memberships)
        {
            var user = await users.FindByIdAsync(m.UserId, ct);
            if (user is not null) result.Add(new(m.UserId, user.Email, user.DisplayName, m.Role));
        }
        return result;
    }
}
public sealed record AddWorkspaceMemberCommand(Guid ActorId, Guid WorkspaceId, string Email, WorkspaceRole Role) : IRequest<MemberDto>;
public sealed class AddWorkspaceMemberValidator : AbstractValidator<AddWorkspaceMemberCommand>
{
    public AddWorkspaceMemberValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(255);
        RuleFor(x => x.Role).Must(x => x is WorkspaceRole.Admin or WorkspaceRole.Member)
            .WithMessage("Only Admin or Member may be assigned");
    }
}
public sealed class AddWorkspaceMemberHandler(IWorkspaceRepository workspaces, IUserRepository users, IUnitOfWork uow)
    : IRequestHandler<AddWorkspaceMemberCommand, MemberDto>
{
    public async ValueTask<MemberDto> Handle(AddWorkspaceMemberCommand request, CancellationToken ct)
    {
        var actor = await workspaces.FindMemberAsync(request.WorkspaceId, request.ActorId, ct);
        if (actor is null || (actor.Role is not WorkspaceRole.Owner and not WorkspaceRole.Admin))
            throw AppException.Forbidden();
        var user = await users.FindByEmailAsync(request.Email.Trim().ToLowerInvariant(), ct)
            ?? throw AppException.NotFound("User must sign in first");
        if (await workspaces.FindMemberAsync(request.WorkspaceId, user.Id, ct) is not null)
            throw AppException.Conflict("Already a workspace member");
        workspaces.AddMember(new WorkspaceMember(request.WorkspaceId, user.Id, request.Role));
        await uow.SaveChangesAsync(ct);
        return new(user.Id, user.Email, user.DisplayName, request.Role);
    }
}
