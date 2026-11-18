using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class CreateWorkspaceHandler(IWorkspaceRepository workspaces, IUnitOfWork uow)
    : IRequestHandler<CreateWorkspaceCommand, WorkspaceDto>
{
    public async ValueTask<WorkspaceDto> Handle(CreateWorkspaceCommand request, CancellationToken ct)
    {
        // First installation bootstrap. Every subsequent workspace needs TeamLead capability.
        if (!await WorkspacePermissions.CanCreateWorkspaceAsync(workspaces, request.ActorId, ct))
            throw AppException.Forbidden("Only Team Lead can create another workspace");
        var ws = new Workspace(request.Name, request.ActorId);
        workspaces.Add(ws);
        workspaces.AddMember(new WorkspaceMember(ws.Id, request.ActorId, WorkspaceRole.Owner));
        await uow.SaveChangesAsync(ct);
        return new(ws.Id, ws.Name, ws.OwnerUserId);
    }
}
