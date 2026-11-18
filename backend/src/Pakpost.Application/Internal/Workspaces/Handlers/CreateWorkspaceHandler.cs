using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class CreateWorkspaceHandler(
    IWorkspaceRepository workspaces,
    IUnitOfWork unitOfWork)
    : IRequestHandler<CreateWorkspaceCommand, WorkspaceDto>
{
    public async ValueTask<WorkspaceDto> Handle(
        CreateWorkspaceCommand command,
        CancellationToken ct)
    {
        if (!await WorkspacePermissions.CanCreateWorkspaceAsync(workspaces, command.ActorId, ct))
        {
            throw AppException.Forbidden("Only Team Lead can create another workspace");
        }

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
