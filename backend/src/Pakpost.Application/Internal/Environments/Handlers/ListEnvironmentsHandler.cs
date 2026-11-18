using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Environments.DTOs;
using Pakpost.Application.Internal.Environments.Queries;
using Pakpost.Application.Internal.Environments.Services;

namespace Pakpost.Application.Internal.Environments.Handlers;

public sealed class ListEnvironmentsHandler(
    IWorkspaceRepository workspaces,
    IRequestEnvironmentRepository environments,
    IEnvironmentValueCipher cipher)
    : IRequestHandler<ListEnvironmentsQuery, IReadOnlyList<RequestEnvironmentDto>>
{
    public async ValueTask<IReadOnlyList<RequestEnvironmentDto>> Handle(ListEnvironmentsQuery q, CancellationToken ct)
    {
        var member = await EnvironmentAccess.Verify(workspaces, q.WorkspaceId, q.ActorId, false, ct);
        bool canReadSecrets = WorkspacePermissions.Can(member, WorkspacePermissions.EnvironmentSecretRead);
        return (await environments.ListAsync(q.WorkspaceId, ct)).Select(e => EnvironmentAccess.ToDto(e, cipher, canReadSecrets)).ToArray();
    }
}
