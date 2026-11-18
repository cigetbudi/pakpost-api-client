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

public sealed class ResendWorkspaceInvitationHandler(
    IWorkspaceRepository workspaces, IWorkspaceInvitationRepository invitations, IUserRepository users,
    IWorkspaceInvitationEmailSender emailSender, IConfiguration config, IUnitOfWork uow,
    ILogger<ResendWorkspaceInvitationHandler> logger)
    : IRequestHandler<ResendWorkspaceInvitationCommand, InvitationDto>
{
    public async ValueTask<InvitationDto> Handle(ResendWorkspaceInvitationCommand c, CancellationToken ct)
    {
        var actor = await WorkspacePermissions.RequireAsync(workspaces, c.WorkspaceId, c.ActorId, WorkspacePermissions.MemberManage, ct);
        var invitation = await invitations.FindAsync(c.InvitationId, ct);
        if (invitation is null || invitation.WorkspaceId != c.WorkspaceId)
            throw AppException.NotFound();
        RoleDelegation.Check(actor, invitation.Roles);
        var now = DateTimeOffset.UtcNow;
        if (!invitation.IsPending(now))
            throw AppException.Conflict("Invitation is no longer pending");
        if (now-invitation.SentAt<TimeSpan.FromMinutes(1))
            throw AppException.Conflict("Wait one minute before resending");
        var existing = await users.FindByEmailAsync(invitation.Email, ct);
        if (existing is not null && await workspaces.FindMemberAsync(c.WorkspaceId, existing.Id, ct) is not null)
            throw AppException.Conflict("User is already a workspace member");
        var ws = await workspaces.FindAsync(c.WorkspaceId, ct)??throw AppException.NotFound();
        var token = InvitationTokens.Generate();
        await emailSender.SendAsync(invitation.Email, ws.Name, InvitationTokens.Link(config, token), ct);
        invitation.Resend(InvitationTokens.Hash(token), now);
        await uow.SaveChangesAsync(ct);
        logger.LogInformation("Workspace invitation resent {InvitationId} {WorkspaceId}", c.InvitationId, c.WorkspaceId);
        return InvitationTokens.ToDto(invitation);
    }
}
