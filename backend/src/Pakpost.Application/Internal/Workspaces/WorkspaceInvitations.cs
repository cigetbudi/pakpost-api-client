using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Mediator;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed record InvitationDto(Guid Id,string Email,IReadOnlyList<WorkspaceAccessRole> Roles,
    DateTimeOffset CreatedAt,DateTimeOffset ExpiresAt,DateTimeOffset? AcceptedAt,DateTimeOffset? RevokedAt);
public sealed record InviteWorkspaceMemberCommand(Guid ActorId,Guid WorkspaceId,string Email,
    IReadOnlyList<WorkspaceAccessRole> Roles):IRequest<InvitationDto>;
public sealed record ListWorkspaceInvitationsQuery(Guid ActorId,Guid WorkspaceId):IRequest<IReadOnlyList<InvitationDto>>;
public sealed record ResendWorkspaceInvitationCommand(Guid ActorId,Guid WorkspaceId,Guid InvitationId):IRequest<InvitationDto>;
public sealed record RevokeWorkspaceInvitationCommand(Guid ActorId,Guid WorkspaceId,Guid InvitationId):IRequest<bool>;
public sealed record AcceptWorkspaceInvitationCommand(Guid ActorId,string Token):IRequest<WorkspaceDto>;

public sealed class InviteWorkspaceMemberValidator:AbstractValidator<InviteWorkspaceMemberCommand>
{
    public InviteWorkspaceMemberValidator()
    {
        RuleFor(x=>x.Email).NotEmpty().EmailAddress().MaximumLength(255);
        RuleFor(x=>x.Roles).NotNull().Must(x=>x is {Count:>0 and <=5} && x.All(r=>Enum.IsDefined(r)))
            .WithMessage("Choose one or more valid roles");
    }
}
public sealed class AcceptWorkspaceInvitationValidator:AbstractValidator<AcceptWorkspaceInvitationCommand>
{
    public AcceptWorkspaceInvitationValidator()=>RuleFor(x=>x.Token).NotEmpty().MaximumLength(256);
}

internal static class InvitationTokens
{
    public static string Generate()=>Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        .TrimEnd('=').Replace('+','-').Replace('/','_');
    public static string Hash(string token)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    public static InvitationDto ToDto(WorkspaceInvitation x)=>new(x.Id,x.Email,x.Roles,x.CreatedAt,x.ExpiresAt,x.AcceptedAt,x.RevokedAt);
    public static string Link(IConfiguration configuration,string token)
    {
        var root=configuration["Invitations:FrontendBaseUrl"];
        if(!Uri.TryCreate(root,UriKind.Absolute,out var url)||
           (url.Scheme!=Uri.UriSchemeHttps&&!(url.Scheme==Uri.UriSchemeHttp&&url.IsLoopback))||
           !string.IsNullOrEmpty(url.UserInfo)||!string.IsNullOrEmpty(url.Query)||!string.IsNullOrEmpty(url.Fragment))
            throw AppException.BadRequest("Set Invitations__FrontendBaseUrl to the trusted PakPost frontend URL (HTTPS outside localhost)");
        return new Uri(url,$"?invite={Uri.EscapeDataString(token)}").ToString();
    }
}

public sealed class InviteWorkspaceMemberHandler(
    IWorkspaceRepository workspaces,IWorkspaceInvitationRepository invitations,IUserRepository users,
    IWorkspaceInvitationEmailSender emailSender,IConfiguration config,IUnitOfWork uow,
    ILogger<InviteWorkspaceMemberHandler> logger)
    :IRequestHandler<InviteWorkspaceMemberCommand,InvitationDto>
{
    public async ValueTask<InvitationDto> Handle(InviteWorkspaceMemberCommand c,CancellationToken ct)
    {
        var actor=await WorkspacePermissions.RequireAsync(workspaces,c.WorkspaceId,c.ActorId,
            WorkspacePermissions.MemberManage,ct);
        RoleDelegation.Check(actor,c.Roles);
        var workspace=await workspaces.FindAsync(c.WorkspaceId,ct)??throw AppException.NotFound();
        var address=c.Email.Trim().ToLowerInvariant();
        var user=await users.FindByEmailAsync(address,ct);
        if(user is not null&&await workspaces.FindMemberAsync(c.WorkspaceId,user.Id,ct) is not null)
            throw AppException.Conflict("User already belongs to this workspace");
        var now=DateTimeOffset.UtcNow;
        if(await invitations.HasPendingAsync(c.WorkspaceId,address,now,ct))
            throw AppException.Conflict("A pending invitation already exists for this email");
        if(await invitations.CountPendingAsync(c.WorkspaceId,now,ct)>=100)
            throw AppException.Conflict("Workspace has too many pending invitations");
        var token=InvitationTokens.Generate();
        var invitation=new WorkspaceInvitation(c.WorkspaceId,c.ActorId,address,c.Roles,
            InvitationTokens.Hash(token),now);
        var link=InvitationTokens.Link(config,token);
        // Never expose the token in API responses or logs.
        await emailSender.SendAsync(address,workspace.Name,link,ct);
        invitations.Add(invitation);
        await uow.SaveChangesAsync(ct);
        logger.LogInformation("Workspace invitation created {InvitationId} {WorkspaceId}",invitation.Id,c.WorkspaceId);
        return InvitationTokens.ToDto(invitation);
    }
}
public sealed class ListWorkspaceInvitationsHandler(IWorkspaceRepository workspaces,IWorkspaceInvitationRepository invitations)
    :IRequestHandler<ListWorkspaceInvitationsQuery,IReadOnlyList<InvitationDto>>
{
    public async ValueTask<IReadOnlyList<InvitationDto>> Handle(ListWorkspaceInvitationsQuery q,CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(workspaces,q.WorkspaceId,q.ActorId,WorkspacePermissions.MemberManage,ct);
        return (await invitations.ListAsync(q.WorkspaceId,ct)).Select(InvitationTokens.ToDto).ToArray();
    }
}
public sealed class ResendWorkspaceInvitationHandler(
    IWorkspaceRepository workspaces,IWorkspaceInvitationRepository invitations,IUserRepository users,
    IWorkspaceInvitationEmailSender emailSender,IConfiguration config,IUnitOfWork uow,
    ILogger<ResendWorkspaceInvitationHandler> logger)
    :IRequestHandler<ResendWorkspaceInvitationCommand,InvitationDto>
{
    public async ValueTask<InvitationDto> Handle(ResendWorkspaceInvitationCommand c,CancellationToken ct)
    {
        var actor=await WorkspacePermissions.RequireAsync(workspaces,c.WorkspaceId,c.ActorId,WorkspacePermissions.MemberManage,ct);
        var invitation=await invitations.FindAsync(c.InvitationId,ct);
        if(invitation is null||invitation.WorkspaceId!=c.WorkspaceId)throw AppException.NotFound();
        RoleDelegation.Check(actor,invitation.Roles);
        var now=DateTimeOffset.UtcNow;
        if(!invitation.IsPending(now))throw AppException.Conflict("Invitation is no longer pending");
        if(now-invitation.SentAt<TimeSpan.FromMinutes(1))throw AppException.Conflict("Wait one minute before resending");
        var existing=await users.FindByEmailAsync(invitation.Email,ct);
        if(existing is not null&&await workspaces.FindMemberAsync(c.WorkspaceId,existing.Id,ct) is not null)
            throw AppException.Conflict("User is already a workspace member");
        var ws=await workspaces.FindAsync(c.WorkspaceId,ct)??throw AppException.NotFound();
        var token=InvitationTokens.Generate();
        await emailSender.SendAsync(invitation.Email,ws.Name,InvitationTokens.Link(config,token),ct);
        invitation.Resend(InvitationTokens.Hash(token),now);
        await uow.SaveChangesAsync(ct);
        logger.LogInformation("Workspace invitation resent {InvitationId} {WorkspaceId}",c.InvitationId,c.WorkspaceId);
        return InvitationTokens.ToDto(invitation);
    }
}
public sealed class RevokeWorkspaceInvitationHandler(
    IWorkspaceRepository workspaces,IWorkspaceInvitationRepository invitations,IUnitOfWork uow,
    ILogger<RevokeWorkspaceInvitationHandler> logger)
    :IRequestHandler<RevokeWorkspaceInvitationCommand,bool>
{
    public async ValueTask<bool> Handle(RevokeWorkspaceInvitationCommand c,CancellationToken ct)
    {
        var actor=await WorkspacePermissions.RequireAsync(workspaces,c.WorkspaceId,c.ActorId,WorkspacePermissions.MemberManage,ct);
        var invitation=await invitations.FindAsync(c.InvitationId,ct);
        if(invitation is null||invitation.WorkspaceId!=c.WorkspaceId)throw AppException.NotFound();
        RoleDelegation.Check(actor,invitation.Roles);
        if(!invitation.IsPending(DateTimeOffset.UtcNow))throw AppException.Conflict("Invitation is no longer pending");
        invitation.Revoke(DateTimeOffset.UtcNow);
        await uow.SaveChangesAsync(ct);
        logger.LogInformation("Workspace invitation revoked {InvitationId} {WorkspaceId}",c.InvitationId,c.WorkspaceId);
        return true;
    }
}
public sealed class AcceptWorkspaceInvitationHandler(
    IWorkspaceInvitationRepository invitations,IWorkspaceRepository workspaces,IUserRepository users,
    IUserExternalIdentityRepository identities,IUnitOfWork uow,
    ILogger<AcceptWorkspaceInvitationHandler> logger)
    :IRequestHandler<AcceptWorkspaceInvitationCommand,WorkspaceDto>
{
    public async ValueTask<WorkspaceDto> Handle(AcceptWorkspaceInvitationCommand c,CancellationToken ct)
    {
        var hash=InvitationTokens.Hash(c.Token);
        var invitation=await invitations.FindByTokenHashAsync(hash,ct);
        if(invitation is null||!invitation.IsPending(DateTimeOffset.UtcNow))
            throw AppException.BadRequest("Invitation is invalid or expired");
        var user=await users.FindByIdAsync(c.ActorId,ct)??throw AppException.Unauthorized();
        // Local sign-up has no verified email workflow. Require a linked, verified Google identity.
        if(!string.Equals(user.Email,invitation.Email,StringComparison.OrdinalIgnoreCase)||
           await identities.FindByUserProviderAsync(user.Id,"google",ct) is null)
            throw AppException.Forbidden("Sign in with a Google-verified PakPost account matching the invitation email");
        var workspace=await workspaces.FindAsync(invitation.WorkspaceId,ct)??throw AppException.NotFound();
        if(await workspaces.FindMemberAsync(invitation.WorkspaceId,user.Id,ct) is not null)
            throw AppException.Conflict("Already a member of this workspace");
        var roles=invitation.Roles;
        if(roles.Count==0||roles.Any(r=>!Enum.IsDefined(r)))throw AppException.BadRequest("Invitation roles invalid");
        var legacy=roles.Contains(WorkspaceAccessRole.TeamLead)||roles.Contains(WorkspaceAccessRole.WorkspaceAdmin)
            ?WorkspaceRole.Admin:WorkspaceRole.Member;
        workspaces.AddMember(new WorkspaceMember(invitation.WorkspaceId,user.Id,legacy,roles));
        invitation.Accept(DateTimeOffset.UtcNow);
        // SaveChanges persists the membership and acceptance together in a transaction.
        await uow.SaveChangesAsync(ct);
        logger.LogInformation("Workspace invitation accepted {InvitationId} {WorkspaceId}",invitation.Id,invitation.WorkspaceId);
        return new WorkspaceDto(workspace.Id,workspace.Name,workspace.OwnerUserId);
    }
}
