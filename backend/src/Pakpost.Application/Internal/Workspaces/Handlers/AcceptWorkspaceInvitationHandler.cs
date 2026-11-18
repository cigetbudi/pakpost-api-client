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

public sealed class AcceptWorkspaceInvitationHandler(
    IWorkspaceInvitationRepository invitations, IWorkspaceRepository workspaces, IUserRepository users,
    IUserExternalIdentityRepository identities, IUnitOfWork uow,
    ILogger<AcceptWorkspaceInvitationHandler> logger)
    : IRequestHandler<AcceptWorkspaceInvitationCommand, WorkspaceDto>
{
    public async ValueTask<WorkspaceDto> Handle(AcceptWorkspaceInvitationCommand c, CancellationToken ct)
    {
        var hash = InvitationTokens.Hash(c.Token);
        var invitation = await invitations.FindByTokenHashAsync(hash, ct);
        if (invitation is null || !invitation.IsPending(DateTimeOffset.UtcNow))
            throw AppException.BadRequest("Invitation is invalid or expired");
        var user = await users.FindByIdAsync(c.ActorId, ct)??throw AppException.Unauthorized();
        // Local sign-up has no verified email workflow. Require a linked, verified Google identity.
        if (!string.Equals(user.Email, invitation.Email, StringComparison.OrdinalIgnoreCase) ||
            await identities.FindByUserProviderAsync(user.Id, "google", ct) is null)
        throw AppException.Forbidden("Sign in with a Google-verified PakPost account matching the invitation email");
        var workspace = await workspaces.FindAsync(invitation.WorkspaceId, ct)??throw AppException.NotFound();
        if (await workspaces.FindMemberAsync(invitation.WorkspaceId, user.Id, ct) is not null)
            throw AppException.Conflict("Already a member of this workspace");
        var roles = invitation.Roles;
        if (roles.Count == 0 || roles.Any(r => !Enum.IsDefined(r)))
            throw AppException.BadRequest("Invitation roles invalid");
        var legacy = roles.Contains(WorkspaceAccessRole.TeamLead) || roles.Contains(WorkspaceAccessRole.WorkspaceAdmin)
        ?WorkspaceRole.Admin:WorkspaceRole.Member;
        workspaces.AddMember(new WorkspaceMember(invitation.WorkspaceId, user.Id, legacy, roles));
        invitation.Accept(DateTimeOffset.UtcNow);
        // SaveChanges persists the membership and acceptance together in a transaction.
        await uow.SaveChangesAsync(ct);
        logger.LogInformation("Workspace invitation accepted {InvitationId} {WorkspaceId}", invitation.Id, invitation.WorkspaceId);
        return new WorkspaceDto(workspace.Id, workspace.Name, workspace.OwnerUserId);
    }
}
