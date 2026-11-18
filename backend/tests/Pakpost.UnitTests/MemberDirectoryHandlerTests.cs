using NSubstitute;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Teams.Handlers;
using Pakpost.Application.Internal.Teams.Queries;
using Pakpost.Application.Internal.Workspaces.Handlers;
using Pakpost.Application.Internal.Workspaces.Queries;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class MemberDirectoryHandlerTests
{
    [Fact]
    public async Task WorkspaceMembersLoadUsersInOneBatchAndKeepMembershipOrder()
    {
        var context = CreateContext();
        var first = new User("first@example.test", "First", "hash");
        var second = new User("second@example.test", "Second", "hash");

        context.Workspaces.ListMembersAsync(context.WorkspaceId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<WorkspaceMember>>(
            [
                Member(context.WorkspaceId, second.Id, WorkspaceAccessRole.QA),
                Member(context.WorkspaceId, first.Id, WorkspaceAccessRole.Developer)
            ]));

        context.Users.FindByIdsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<User>>([first, second]));

        var handler = new ListWorkspaceMembersHandler(context.Workspaces, context.Users);
        var result = await handler.Handle(
            new ListWorkspaceMembersQuery(context.ActorId, context.WorkspaceId),
            CancellationToken.None);

        Assert.Equal(new[] { second.Id, first.Id }, result.Select(member => member.UserId).ToArray());
        Assert.Equal(new[] { "Second", "First" }, result.Select(member => member.DisplayName).ToArray());
        Assert.DoesNotContain("collection.write", result[0].Permissions);
        Assert.Contains("collection.write", result[1].Permissions);

        await context.Users.Received(1).FindByIdsAsync(
            Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 2),
            Arg.Any<CancellationToken>());

        await context.Users.DidNotReceive().FindByIdAsync(
            Arg.Any<Guid>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WorkspaceMembersSkipUnknownUsersWithoutExtraQueries()
    {
        var context = CreateContext();
        var known = new User("known@example.test", "Known", "hash");

        context.Workspaces.ListMembersAsync(context.WorkspaceId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<WorkspaceMember>>(
            [
                Member(context.WorkspaceId, Guid.NewGuid(), WorkspaceAccessRole.QA),
                Member(context.WorkspaceId, known.Id, WorkspaceAccessRole.QA)
            ]));

        context.Users.FindByIdsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<User>>([known]));

        var result = await new ListWorkspaceMembersHandler(context.Workspaces, context.Users)
            .Handle(new ListWorkspaceMembersQuery(context.ActorId, context.WorkspaceId), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal(known.Id, result[0].UserId);
    }

    [Fact]
    public async Task TeamMembersLoadUsersInOneBatchAndKeepMemberOrder()
    {
        var context = CreateContext();
        var teams = Substitute.For<ITeamRepository>();
        var team = new Team(context.WorkspaceId, context.ActorId, "Platform");
        var first = new User("first@example.test", "First", "hash");
        var second = new User("second@example.test", "Second", "hash");

        teams.FindAsync(team.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<Team?>(team));

        teams.ListMembersAsync(team.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<TeamMember>>(
            [
                new TeamMember(team.Id, second.Id),
                new TeamMember(team.Id, first.Id)
            ]));

        context.Users.FindByIdsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<User>>([first, second]));

        var handler = new ListTeamMembersHandler(context.Workspaces, teams, context.Users);
        var result = await handler.Handle(
            new ListTeamMembersQuery(context.ActorId, context.WorkspaceId, team.Id),
            CancellationToken.None);

        Assert.Equal(new[] { second.Id, first.Id }, result.Select(member => member.UserId).ToArray());
        await context.Users.Received(1).FindByIdsAsync(
            Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 2),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NonMemberCannotReadTeamMembersOrEnumerateUsers()
    {
        var context = CreateContext(authorized: false);
        var teams = Substitute.For<ITeamRepository>();
        var handler = new ListTeamMembersHandler(context.Workspaces, teams, context.Users);

        var error = await Assert.ThrowsAsync<AppException>(async () =>
        {
            await handler.Handle(
                new ListTeamMembersQuery(context.ActorId, context.WorkspaceId, Guid.NewGuid()),
                CancellationToken.None);
        });

        Assert.Equal(403, error.StatusCode);

        await teams.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await context.Users.DidNotReceive().FindByIdsAsync(
            Arg.Any<IReadOnlyCollection<Guid>>(),
            Arg.Any<CancellationToken>());
    }

    private static TestContext CreateContext(bool authorized = true)
    {
        var workspaceId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var workspaces = Substitute.For<IWorkspaceRepository>();
        var users = Substitute.For<IUserRepository>();

        workspaces.FindMemberAsync(workspaceId, actorId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(authorized
                ? Member(workspaceId, actorId, WorkspaceAccessRole.QA)
                : null));

        return new TestContext(workspaceId, actorId, workspaces, users);
    }

    private static WorkspaceMember Member(
        Guid workspaceId,
        Guid userId,
        WorkspaceAccessRole role)
    {
        return new WorkspaceMember(workspaceId, userId, WorkspaceRole.Member, [role]);
    }

    private sealed record TestContext(
        Guid WorkspaceId,
        Guid ActorId,
        IWorkspaceRepository Workspaces,
        IUserRepository Users);
}
