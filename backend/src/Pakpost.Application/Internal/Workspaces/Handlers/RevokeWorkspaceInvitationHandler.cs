using Mediator;
using Microsoft.Extensions.Logging;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.Services;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class RevokeWorkspaceInvitationHandler(
    IWorkspaceRepository workspaces,
    IWorkspaceInvitationRepository invitations,
    IUnitOfWork unitOfWork,
    ILogger<RevokeWorkspaceInvitationHandler> logger)
    : IRequestHandler<RevokeWorkspaceInvitationCommand, bool>
{
    public async ValueTask<bool> Handle(
        RevokeWorkspaceInvitationCommand command,
        CancellationToken ct)
    {
        var actor = await WorkspacePermissions.RequireAsync(
            workspaces,
            command.WorkspaceId,
            command.ActorId,
            WorkspacePermissions.MemberManage,
            ct);

        var invitation = await invitations.FindAsync(command.InvitationId, ct);

        if (invitation is null || invitation.WorkspaceId != command.WorkspaceId)
        {
            throw AppException.NotFound();
        }

        RoleDelegation.Check(actor, invitation.Roles);

        var now = DateTimeOffset.UtcNow;

        if (!invitation.IsPending(now))
        {
            throw AppException.Conflict("Invitation is no longer pending");
        }

        invitation.Revoke(now);
        await unitOfWork.SaveChangesAsync(ct);

        logger.LogInformation(
            "Workspace invitation revoked {InvitationId} {WorkspaceId}",
            command.InvitationId,
            command.WorkspaceId);

        return true;
    }
}
