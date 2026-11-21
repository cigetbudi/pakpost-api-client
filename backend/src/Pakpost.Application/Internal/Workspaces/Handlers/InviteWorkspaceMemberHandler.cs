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
    IWorkspaceCapacity capacity,
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

        var policy = WorkspaceDeploymentPolicy.From(configuration);
        await using var transaction = await capacity.LockAsync(command.WorkspaceId, ct);
        var now = DateTimeOffset.UtcNow;
        if (policy.MaxMembers is int limit &&
            await capacity.CountReservedSeatsAsync(command.WorkspaceId, now, ct) >= limit)
            throw AppException.Conflict($"Workspace has reached its {limit}-person limit (including pending invitations)");

        if (await invitations.HasPendingAsync(command.WorkspaceId, address, now, ct))
        {
            throw AppException.Conflict("A pending invitation already exists for this email");
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
        await transaction.CommitAsync(ct);

        logger.LogInformation(
            "Workspace invitation created {InvitationId} {WorkspaceId}",
            invitation.Id,
            command.WorkspaceId);

        return InvitationTokens.ToDto(invitation);
    }
}
