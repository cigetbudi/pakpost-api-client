using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Teams;

public sealed class ListTeamsHandler(IWorkspaceRepository w, ITeamRepository t) : IRequestHandler<ListTeamsQuery, IReadOnlyList<TeamDto>>
{
    public async ValueTask<IReadOnlyList<TeamDto>> Handle(ListTeamsQuery q, CancellationToken ct)
    {
        if (await w.FindMemberAsync(q.WorkspaceId, q.ActorId, ct) is null)
            throw AppException.Forbidden();
        return (await t.ListAsync(q.WorkspaceId, ct)).Select(x => new TeamDto(x.Id, x.WorkspaceId, x.Name)).ToArray();
    }
}
