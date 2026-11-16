using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;
namespace Pakpost.Application.Internal.Workspaces;
public sealed record WorkspaceDto(Guid Id,string Name,Guid OwnerUserId);
public sealed record CreateWorkspaceCommand(Guid ActorId,string Name):IRequest<WorkspaceDto>;
public sealed class CreateWorkspaceValidator:AbstractValidator<CreateWorkspaceCommand>
{ public CreateWorkspaceValidator()=>RuleFor(x=>x.Name).NotEmpty().MaximumLength(120); }
public sealed class CreateWorkspaceHandler(IWorkspaceRepository workspaces,IUnitOfWork uow)
    :IRequestHandler<CreateWorkspaceCommand,WorkspaceDto>
{
    public async ValueTask<WorkspaceDto> Handle(CreateWorkspaceCommand request,CancellationToken ct)
    {
        // First installation bootstrap. Every subsequent workspace needs TeamLead capability.
        if(!await WorkspacePermissions.CanCreateWorkspaceAsync(workspaces,request.ActorId,ct))
            throw AppException.Forbidden("Only Team Lead can create another workspace");
        var ws=new Workspace(request.Name,request.ActorId);
        workspaces.Add(ws);
        workspaces.AddMember(new WorkspaceMember(ws.Id,request.ActorId,WorkspaceRole.Owner));
        await uow.SaveChangesAsync(ct);
        return new(ws.Id,ws.Name,ws.OwnerUserId);
    }
}
public sealed record GetWorkspaceCapabilitiesQuery(Guid ActorId):IRequest<WorkspaceCapabilitiesDto>;
public sealed record WorkspaceCapabilitiesDto(bool CanCreateWorkspace);
public sealed class GetWorkspaceCapabilitiesHandler(IWorkspaceRepository workspaces)
    :IRequestHandler<GetWorkspaceCapabilitiesQuery,WorkspaceCapabilitiesDto>
{
    public async ValueTask<WorkspaceCapabilitiesDto> Handle(GetWorkspaceCapabilitiesQuery query,CancellationToken ct)
        =>new(await WorkspacePermissions.CanCreateWorkspaceAsync(workspaces,query.ActorId,ct));
}
public sealed record ListWorkspacesQuery(Guid ActorId):IRequest<IReadOnlyList<WorkspaceDto>>;
public sealed class ListWorkspacesHandler(IWorkspaceRepository workspaces)
    :IRequestHandler<ListWorkspacesQuery,IReadOnlyList<WorkspaceDto>>
{
    public async ValueTask<IReadOnlyList<WorkspaceDto>> Handle(ListWorkspacesQuery request,CancellationToken ct)
        =>(await workspaces.ListForUserAsync(request.ActorId,ct))
            .Select(x=>new WorkspaceDto(x.Id,x.Name,x.OwnerUserId)).ToArray();
}
public sealed record MemberDto(Guid UserId,string Email,string DisplayName,WorkspaceRole Role,
    IReadOnlyList<WorkspaceAccessRole> Roles,IReadOnlyList<string> Permissions);
public sealed record ListWorkspaceMembersQuery(Guid ActorId,Guid WorkspaceId):IRequest<IReadOnlyList<MemberDto>>;
public sealed class ListWorkspaceMembersHandler(IWorkspaceRepository workspaces,IUserRepository users)
    :IRequestHandler<ListWorkspaceMembersQuery,IReadOnlyList<MemberDto>>
{
    public async ValueTask<IReadOnlyList<MemberDto>> Handle(ListWorkspaceMembersQuery query,CancellationToken ct)
    {
        await WorkspacePermissions.RequireMemberAsync(workspaces,query.WorkspaceId,query.ActorId,ct);
        var memberships=await workspaces.ListMembersAsync(query.WorkspaceId,ct);
        var result=new List<MemberDto>();
        foreach(var m in memberships)
        {
            var user=await users.FindByIdAsync(m.UserId,ct);
            if(user is not null)
            {
                var roles=WorkspacePermissions.RolesOf(m);
                result.Add(new(m.UserId,user.Email,user.DisplayName,m.Role,roles,
                    WorkspacePermissions.EffectivePermissions(roles)));
            }
        }
        return result;
    }
}
public sealed record AddWorkspaceMemberCommand(Guid ActorId,Guid WorkspaceId,string Email,
    WorkspaceRole Role,IReadOnlyList<WorkspaceAccessRole>? Roles=null):IRequest<MemberDto>;
public sealed class AddWorkspaceMemberValidator:AbstractValidator<AddWorkspaceMemberCommand>
{
    public AddWorkspaceMemberValidator()
    {
        RuleFor(x=>x.Email).NotEmpty().EmailAddress().MaximumLength(255);
        RuleFor(x=>x.Role).Must(x=>x is WorkspaceRole.Admin or WorkspaceRole.Member)
            .WithMessage("Legacy role must be Admin or Member");
        RuleFor(x=>x.Roles).Must(x=>x is null || (x.Count>0 && x.Count<=5 &&
            x.All(r=>Enum.IsDefined(r)))).WithMessage("Select valid roles");
    }
}
public static class RoleDelegation
{
    public static IReadOnlyList<WorkspaceAccessRole> ResolveRequestedRoles(
        WorkspaceRole legacy,IReadOnlyList<WorkspaceAccessRole>? requested)
    {
        if(requested is {Count:>0})return requested.Distinct().ToArray();
        if(legacy==WorkspaceRole.Admin)
            return new[]{WorkspaceAccessRole.WorkspaceAdmin,WorkspaceAccessRole.Developer};
        return new[]{WorkspaceAccessRole.Developer};
    }
    public static void Check(WorkspaceMember actor,IEnumerable<WorkspaceAccessRole> requested)
    {
        var roles=requested.ToArray();
        if(!WorkspacePermissions.Can(actor,WorkspacePermissions.RoleAssign))throw AppException.Forbidden();
        if(!WorkspacePermissions.RolesOf(actor).Contains(WorkspaceAccessRole.TeamLead) &&
            roles.Any(r=>r is WorkspaceAccessRole.TeamLead or WorkspaceAccessRole.WorkspaceAdmin))
            throw AppException.Forbidden("Only Team Lead may grant lead/admin roles");
    }
}
public sealed class AddWorkspaceMemberHandler(IWorkspaceRepository workspaces,IUserRepository users,IUnitOfWork uow)
    :IRequestHandler<AddWorkspaceMemberCommand,MemberDto>
{
    public async ValueTask<MemberDto> Handle(AddWorkspaceMemberCommand request,CancellationToken ct)
    {
        var actor=await WorkspacePermissions.RequireAsync(workspaces,request.WorkspaceId,request.ActorId,
            WorkspacePermissions.MemberManage,ct);
        var roles=RoleDelegation.ResolveRequestedRoles(request.Role,request.Roles);
        RoleDelegation.Check(actor,roles);
        var user=await users.FindByEmailAsync(request.Email.Trim().ToLowerInvariant(),ct)
            ??throw AppException.NotFound("User must sign in first");
        if(await workspaces.FindMemberAsync(request.WorkspaceId,user.Id,ct) is not null)
            throw AppException.Conflict("Already a workspace member");
        var legacy=roles.Contains(WorkspaceAccessRole.TeamLead)||roles.Contains(WorkspaceAccessRole.WorkspaceAdmin)
            ?WorkspaceRole.Admin:WorkspaceRole.Member;
        workspaces.AddMember(new WorkspaceMember(request.WorkspaceId,user.Id,legacy,roles));
        await uow.SaveChangesAsync(ct);
        return new(user.Id,user.Email,user.DisplayName,legacy,roles,
            WorkspacePermissions.EffectivePermissions(roles));
    }
}
public sealed record UpdateWorkspaceMemberRolesCommand(Guid ActorId,Guid WorkspaceId,Guid UserId,
    IReadOnlyList<WorkspaceAccessRole> Roles):IRequest<MemberDto>;
public sealed class UpdateWorkspaceMemberRolesValidator:AbstractValidator<UpdateWorkspaceMemberRolesCommand>
{
    public UpdateWorkspaceMemberRolesValidator()
    {
        RuleFor(x=>x.UserId).NotEmpty();
        RuleFor(x=>x.Roles).NotNull().Must(x=>x is {Count:>0 and <=5} &&
            x.All(r=>Enum.IsDefined(r))).WithMessage("Select one or more valid roles");
    }
}
public sealed class UpdateWorkspaceMemberRolesHandler(IWorkspaceRepository workspaces,IUserRepository users,IUnitOfWork uow)
    :IRequestHandler<UpdateWorkspaceMemberRolesCommand,MemberDto>
{
    public async ValueTask<MemberDto> Handle(UpdateWorkspaceMemberRolesCommand request,CancellationToken ct)
    {
        var actor=await WorkspacePermissions.RequireAsync(workspaces,request.WorkspaceId,request.ActorId,
            WorkspacePermissions.RoleAssign,ct);
        if(request.ActorId==request.UserId)throw AppException.Forbidden("You cannot change your own roles");
        var target=await workspaces.FindMemberForUpdateAsync(request.WorkspaceId,request.UserId,ct)
            ??throw AppException.NotFound("Workspace member not found");
        var ws=await workspaces.FindAsync(request.WorkspaceId,ct)??throw AppException.NotFound();
        // Immutable founder until an explicit audited workspace ownership-transfer feature exists.
        if(target.UserId==ws.OwnerUserId)throw AppException.Forbidden("Cannot modify the founder's roles");
        var before=WorkspacePermissions.RolesOf(target);
        if(!WorkspacePermissions.RolesOf(actor).Contains(WorkspaceAccessRole.TeamLead) &&
            before.Any(r=>r is WorkspaceAccessRole.TeamLead or WorkspaceAccessRole.WorkspaceAdmin))
            throw AppException.Forbidden("Only Team Lead may modify privileged members");
        RoleDelegation.Check(actor,request.Roles);
        target.ReplaceRoles(request.Roles);
        await uow.SaveChangesAsync(ct);
        var user=await users.FindByIdAsync(request.UserId,ct)??throw AppException.NotFound();
        var assigned=WorkspacePermissions.RolesOf(target);
        return new(target.UserId,user.Email,user.DisplayName,target.Role,assigned,
            WorkspacePermissions.EffectivePermissions(assigned));
    }
}
