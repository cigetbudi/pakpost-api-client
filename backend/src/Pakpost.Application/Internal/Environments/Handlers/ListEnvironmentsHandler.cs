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
    public async ValueTask<IReadOnlyList<RequestEnvironmentDto>> Handle(
        ListEnvironmentsQuery query,
        CancellationToken ct)
    {
        var member = await EnvironmentAccess.Verify(
            workspaces,
            query.WorkspaceId,
            query.ActorId,
            false,
            ct);

        var canReadSecrets = WorkspacePermissions.Can(
            member,
            WorkspacePermissions.EnvironmentSecretRead);

        var items = await environments.ListAsync(query.WorkspaceId, ct);

        return items
            .Select(environment => EnvironmentAccess.ToDto(environment, cipher, canReadSecrets))
            .ToArray();
    }
}
