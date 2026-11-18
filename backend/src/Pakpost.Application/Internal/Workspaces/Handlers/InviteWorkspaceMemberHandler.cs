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

public sealed class InviteWorkspaceMemberHandler(
    IWorkspaceRepository workspaces, IWorkspaceInvitationRepository invitations, IUserRepository users,
    IWorkspaceInvitationEmailSender emailSender, IConfiguration config, IUnitOfWork uow,
    ILogger<InviteWorkspaceMemberHandler> logger)
    : IRequestHandler<InviteWorkspaceMemberCommand, InvitationDto>
{
    public async ValueTask<InvitationDto> Handle(InviteWorkspaceMemberCommand c, CancellationToken ct)
    {
        var actor = await WorkspacePermissions.RequireAsync(workspaces, c.WorkspaceId, c.ActorId,
            WorkspacePermissions.MemberManage, ct);
        RoleDelegation.Check(actor, c.Roles);
        var workspace = await workspaces.FindAsync(c.WorkspaceId, ct)??throw AppException.NotFound();
        var address = c.Email.Trim().ToLowerInvariant();
        var user = await users.FindByEmailAsync(address, ct);
        if (user is not null && await workspaces.FindMemberAsync(c.WorkspaceId, user.Id, ct) is not null)
            throw AppException.Conflict("User already belongs to this workspace");
        var now = DateTimeOffset.UtcNow;
        if (await invitations.HasPendingAsync(c.WorkspaceId, address, now, ct))
            throw AppException.Conflict("A pending invitation already exists for this email");
        if (await invitations.CountPendingAsync(c.WorkspaceId, now, ct) >= 100)
            throw AppException.Conflict("Workspace has too many pending invitations");
        var token = InvitationTokens.Generate();
        var invitation = new WorkspaceInvitation(c.WorkspaceId, c.ActorId, address, c.Roles,
            InvitationTokens.Hash(token), now);
        var link = InvitationTokens.Link(config, token);
        // Never expose the token in API responses or logs.
        await emailSender.SendAsync(address, workspace.Name, link, ct);
        invitations.Add(invitation);
        await uow.SaveChangesAsync(ct);
        logger.LogInformation("Workspace invitation created {InvitationId} {WorkspaceId}", invitation.Id, c.WorkspaceId);
        return InvitationTokens.ToDto(invitation);
    }
}
