using Mediator;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Services;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class ResendWorkspaceInvitationHandler(
    IWorkspaceRepository workspaces,
    IWorkspaceInvitationRepository invitations,
    IUserRepository users,
    IWorkspaceInvitationEmailSender emailSender,
    IConfiguration configuration,
    IUnitOfWork unitOfWork,
    ILogger<ResendWorkspaceInvitationHandler> logger)
    : IRequestHandler<ResendWorkspaceInvitationCommand, InvitationDto>
{
    public async ValueTask<InvitationDto> Handle(
        ResendWorkspaceInvitationCommand command,
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

        if (now - invitation.SentAt < TimeSpan.FromMinutes(1))
        {
            throw AppException.Conflict("Wait one minute before resending");
        }

        var existing = await users.FindByEmailAsync(invitation.Email, ct);

        if (existing is not null &&
            await workspaces.FindMemberAsync(command.WorkspaceId, existing.Id, ct) is not null)
        {
            throw AppException.Conflict("User is already a workspace member");
        }

        var workspace = await workspaces.FindAsync(command.WorkspaceId, ct)
            ?? throw AppException.NotFound();

        var token = InvitationTokens.Generate();
        var link = InvitationTokens.Link(configuration, token);

        await emailSender.SendAsync(invitation.Email, workspace.Name, link, ct);

        invitation.Resend(InvitationTokens.Hash(token), now);
        await unitOfWork.SaveChangesAsync(ct);

        logger.LogInformation(
            "Workspace invitation resent {InvitationId} {WorkspaceId}",
            command.InvitationId,
            command.WorkspaceId);

        return InvitationTokens.ToDto(invitation);
    }
}
