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

public sealed class RevokeWorkspaceInvitationHandler(
    IWorkspaceRepository workspaces, IWorkspaceInvitationRepository invitations, IUnitOfWork uow,
    ILogger<RevokeWorkspaceInvitationHandler> logger)
    : IRequestHandler<RevokeWorkspaceInvitationCommand, bool>
{
    public async ValueTask<bool> Handle(RevokeWorkspaceInvitationCommand c, CancellationToken ct)
    {
        var actor = await WorkspacePermissions.RequireAsync(workspaces, c.WorkspaceId, c.ActorId, WorkspacePermissions.MemberManage, ct);
        var invitation = await invitations.FindAsync(c.InvitationId, ct);
        if (invitation is null || invitation.WorkspaceId != c.WorkspaceId)
            throw AppException.NotFound();
        RoleDelegation.Check(actor, invitation.Roles);
        if (!invitation.IsPending(DateTimeOffset.UtcNow))
            throw AppException.Conflict("Invitation is no longer pending");
        invitation.Revoke(DateTimeOffset.UtcNow);
        await uow.SaveChangesAsync(ct);
        logger.LogInformation("Workspace invitation revoked {InvitationId} {WorkspaceId}", c.InvitationId, c.WorkspaceId);
        return true;
    }
}
