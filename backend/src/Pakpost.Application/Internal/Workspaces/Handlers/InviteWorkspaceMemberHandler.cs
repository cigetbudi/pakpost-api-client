using Mediator;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Services;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class InviteWorkspaceMemberHandler(
    IWorkspaceRepository workspaces,
    IWorkspaceInvitationRepository invitations,
    IUserRepository users,
    IWorkspaceInvitationEmailSender emailSender,
    IConfiguration configuration,
    IUnitOfWork unitOfWork,
    ILogger<InviteWorkspaceMemberHandler> logger)
    : IRequestHandler<InviteWorkspaceMemberCommand, InvitationDto>
{
    public async ValueTask<InvitationDto> Handle(
        InviteWorkspaceMemberCommand command,
        CancellationToken ct)
    {
        var actor = await WorkspacePermissions.RequireAsync(
            workspaces,
            command.WorkspaceId,
            command.ActorId,
            WorkspacePermissions.MemberManage,
            ct);

        RoleDelegation.Check(actor, command.Roles);

        var workspace = await workspaces.FindAsync(command.WorkspaceId, ct)
            ?? throw AppException.NotFound();

        var address = command.Email.Trim().ToLowerInvariant();
        var user = await users.FindByEmailAsync(address, ct);

        if (user is not null &&
            await workspaces.FindMemberAsync(command.WorkspaceId, user.Id, ct) is not null)
        {
            throw AppException.Conflict("User already belongs to this workspace");
        }

        var now = DateTimeOffset.UtcNow;

        if (await invitations.HasPendingAsync(command.WorkspaceId, address, now, ct))
        {
            throw AppException.Conflict("A pending invitation already exists for this email");
        }

        if (await invitations.CountPendingAsync(command.WorkspaceId, now, ct) >= 100)
        {
            throw AppException.Conflict("Workspace has too many pending invitations");
        }

        var token = InvitationTokens.Generate();
        var invitation = new WorkspaceInvitation(
            command.WorkspaceId,
            command.ActorId,
            address,
            command.Roles,
            InvitationTokens.Hash(token),
            now);

        var link = InvitationTokens.Link(configuration, token);
        await emailSender.SendAsync(address, workspace.Name, link, ct);

        invitations.Add(invitation);
        await unitOfWork.SaveChangesAsync(ct);

        logger.LogInformation(
            "Workspace invitation created {InvitationId} {WorkspaceId}",
            invitation.Id,
            command.WorkspaceId);

        return InvitationTokens.ToDto(invitation);
    }
}
