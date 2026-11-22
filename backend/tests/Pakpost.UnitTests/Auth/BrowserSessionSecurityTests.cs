using Microsoft.Extensions.Configuration;
using Pakpost.Api.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.UnitTests;

public sealed class BrowserSessionSecurityTests
{
    private static ServerSessionStore Store() => new(null!, new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> {
            ["Jwt:SigningKey"] = new string('x', 48)
        }).Build());

    [Fact]
    public void SessionTokenIsRandomAndHashDoesNotExposeToken()
    {
        var token1 = ServerSessionStore.RandomProof();
        var token2 = ServerSessionStore.RandomProof();
        Assert.Equal(43, token1.Length);
        Assert.NotEqual(token1, token2);
        Assert.Equal(64, ServerSessionStore.Hash(token1).Length);
        Assert.DoesNotContain(token1, ServerSessionStore.Hash(token1));
    }

    [Fact]
    public void CsrfProofIsBoundToSessionAndAuthenticatedByFixedTimeHashComparison()
    {
        var store = Store();
        var cookie = ServerSessionStore.RandomProof();
        var csrf = store.CsrfProof(cookie);
        var csrfHash = ServerSessionStore.Hash(csrf);
        var session = new BrowserSession(Guid.NewGuid(), Guid.NewGuid(), csrfHash,
            DateTimeOffset.UtcNow.AddHours(1));
        Assert.True(ServerSessionStore.VerifyCsrf(session, csrf));
        Assert.False(ServerSessionStore.VerifyCsrf(session, store.CsrfProof(ServerSessionStore.RandomProof())));
        Assert.False(ServerSessionStore.VerifyCsrf(session, ""));
        Assert.False(ServerSessionStore.VerifyCsrf(session, "not-base64url"));
        Assert.Equal(csrf, store.CsrfProof(cookie));
    }

    [Fact]
    public void ExpiredSessionEntityKeepsAbsoluteExpiry()
    {
        var now = DateTimeOffset.UtcNow;
        var session = new UserSession(Guid.NewGuid(), new string('A', 64), new string('B', 64), now, now.AddHours(8));
        Assert.Equal(now.AddHours(8), session.ExpiresAt);
        session.Revoke(now.AddMinutes(1));
        Assert.Equal(now.AddMinutes(1), session.RevokedAt);
    }
}
