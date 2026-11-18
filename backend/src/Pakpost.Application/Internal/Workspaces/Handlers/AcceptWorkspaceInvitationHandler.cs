using Mediator;
using Microsoft.Extensions.Logging;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Services;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class AcceptWorkspaceInvitationHandler(
    IWorkspaceInvitationRepository invitations,
    IWorkspaceRepository workspaces,
    IUserRepository users,
    IUserExternalIdentityRepository identities,
    IUnitOfWork unitOfWork,
    ILogger<AcceptWorkspaceInvitationHandler> logger)
    : IRequestHandler<AcceptWorkspaceInvitationCommand, WorkspaceDto>
{
    public async ValueTask<WorkspaceDto> Handle(
        AcceptWorkspaceInvitationCommand command,
        CancellationToken ct)
    {
        var hash = InvitationTokens.Hash(command.Token);
        var invitation = await invitations.FindByTokenHashAsync(hash, ct);

        if (invitation is null || !invitation.IsPending(DateTimeOffset.UtcNow))
        {
            throw AppException.BadRequest("Invitation is invalid or expired");
        }

        var user = await users.FindByIdAsync(command.ActorId, ct)
            ?? throw AppException.Unauthorized();

        if (!string.Equals(user.Email, invitation.Email, StringComparison.OrdinalIgnoreCase) ||
            await identities.FindByUserProviderAsync(user.Id, "google", ct) is null)
        {
            throw AppException.Forbidden(
                "Sign in with a Google-verified PakPost account matching the invitation email");
        }

        var workspace = await workspaces.FindAsync(invitation.WorkspaceId, ct)
            ?? throw AppException.NotFound();

        if (await workspaces.FindMemberAsync(invitation.WorkspaceId, user.Id, ct) is not null)
        {
            throw AppException.Conflict("Already a member of this workspace");
        }

        var roles = invitation.Roles;

        if (roles.Count == 0 || roles.Any(role => !Enum.IsDefined(role)))
        {
            throw AppException.BadRequest("Invitation roles invalid");
        }

        var legacyRole = roles.Contains(WorkspaceAccessRole.TeamLead) ||
            roles.Contains(WorkspaceAccessRole.WorkspaceAdmin)
            ? WorkspaceRole.Admin
            : WorkspaceRole.Member;

        workspaces.AddMember(new WorkspaceMember(invitation.WorkspaceId, user.Id, legacyRole, roles));
        invitation.Accept(DateTimeOffset.UtcNow);

        await unitOfWork.SaveChangesAsync(ct);

        logger.LogInformation(
            "Workspace invitation accepted {InvitationId} {WorkspaceId}",
            invitation.Id,
            invitation.WorkspaceId);

        return new WorkspaceDto(workspace.Id, workspace.Name, workspace.OwnerUserId);
    }
}
