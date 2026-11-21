using Mediator;
using Pakpost.Application.Common.Exceptions;
using Microsoft.Extensions.Configuration;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class CreateWorkspaceHandler(
    IWorkspaceRepository workspaces,
    IUserRepository users,
    IUserExternalIdentityRepository identities,
    IConfiguration configuration,
    IUnitOfWork unitOfWork)
    : IRequestHandler<CreateWorkspaceCommand, WorkspaceDto>
{
    public async ValueTask<WorkspaceDto> Handle(
        CreateWorkspaceCommand command,
        CancellationToken ct)
    {
        var policy = WorkspaceDeploymentPolicy.From(configuration);
        if (!await policy.CanCreateAsync(users, identities, command.ActorId, ct))
            throw AppException.Forbidden(policy.IsPublic
                ? "Sign in with a verified Google account to create a workspace"
                : "An instance administrator must enable Workspace Creator for your account");

        var workspace = new Workspace(command.Name, command.ActorId);

        workspaces.Add(workspace);
        workspaces.AddMember(new WorkspaceMember(
            workspace.Id,
            command.ActorId,
            WorkspaceRole.Owner));

        await unitOfWork.SaveChangesAsync(ct);

        return new WorkspaceDto(workspace.Id, workspace.Name, workspace.OwnerUserId);
    }
}
