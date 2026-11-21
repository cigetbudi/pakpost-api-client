using Microsoft.Extensions.Configuration;
using NSubstitute;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.UnitTests;

public sealed class WorkspaceDeploymentPolicyTests
{
    [Theory]
    [InlineData("Public", 10)]
    [InlineData("SelfHosted", null)]
    public void PolicyHasOnlyTheRequestedDeploymentLimits(string mode, int? limit)
    {
        var policy = WorkspaceDeploymentPolicy.From(Config(mode));
        Assert.Equal(limit, policy.MaxMembers);
        Assert.Equal(mode, policy.Mode);
    }

    [Fact]
    public void InvalidDeploymentModeIsRejected()
    {
        Assert.Throws<InvalidOperationException>(() => WorkspaceDeploymentPolicy.From(Config("anything")));
    }

    [Fact]
    public async Task SelfHostedCreatorPermissionDoesNotNeedWorkspaceMembership()
    {
        var user = new User("creator@example.test", "Creator", "not-used");
        user.SetWorkspaceCreation(true);
        var users = Substitute.For<IUserRepository>();
        var identities = Substitute.For<IUserExternalIdentityRepository>();
        users.FindByIdAsync(user.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<User?>(user));

        var policy = WorkspaceDeploymentPolicy.From(Config("SelfHosted"));
        Assert.True(await policy.CanCreateAsync(users, identities, user.Id, CancellationToken.None));
        user.SetWorkspaceCreation(false);
        Assert.False(await policy.CanCreateAsync(users, identities, user.Id, CancellationToken.None));
    }

    [Fact]
    public async Task PublicRequiresVerifiedGoogleIdentityButNotWorkspaceMembership()
    {
        var user = new User("person@example.test", "Person", "not-used");
        var users = Substitute.For<IUserRepository>();
        var identities = Substitute.For<IUserExternalIdentityRepository>();
        users.FindByIdAsync(user.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<User?>(user));
        identities.FindByUserProviderAsync(user.Id, "google", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<UserExternalIdentity?>(null));
        var policy = WorkspaceDeploymentPolicy.From(Config("Public"));
        Assert.False(await policy.CanCreateAsync(users, identities, user.Id, CancellationToken.None));

        identities.FindByUserProviderAsync(user.Id, "google", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<UserExternalIdentity?>(
                new UserExternalIdentity(user.Id, "google", "verified-subject")));
        Assert.True(await policy.CanCreateAsync(users, identities, user.Id, CancellationToken.None));
    }

    [Fact]
    public async Task DisabledCreatorIsNeverAllowed()
    {
        var user = new User("creator@example.test", "Creator", "not-used");
        user.SetWorkspaceCreation(true);
        user.SetDisabled(true);
        var users = Substitute.For<IUserRepository>();
        var identities = Substitute.For<IUserExternalIdentityRepository>();
        users.FindByIdAsync(user.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<User?>(user));
        Assert.False(await WorkspaceDeploymentPolicy.From(Config("SelfHosted"))
            .CanCreateAsync(users, identities, user.Id, CancellationToken.None));
    }

    private static IConfiguration Config(string mode) => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Pakpost:DeploymentMode"] = mode })
        .Build();
}
