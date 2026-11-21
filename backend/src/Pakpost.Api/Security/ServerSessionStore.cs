using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Pakpost.Domain.Entities;
using Pakpost.Infrastructure.Persistence;

namespace Pakpost.Api.Security;

public sealed record BrowserSession(Guid Id, Guid UserId, string CsrfHash, DateTimeOffset ExpiresAt);
public sealed record NewBrowserSession(string OpaqueToken, string CsrfToken, DateTimeOffset ExpiresAt);

public sealed class ServerSessionStore(PakpostDbContext db, IConfiguration config)
{
    public static string Hash(string value) => Convert.ToHexString(
        SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    public static string RandomProof() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public string CsrfProof(string rawToken)
    {
        // The raw cookie is never saved. Derive a per-session proof so a new tab
        // can bootstrap without a second persistent CSRF cookie.
        var key = config["Jwt:SigningKey"] ?? throw new InvalidOperationException("Jwt:SigningKey missing");
        var digest = HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes("pakpost-csrf-v1:" + rawToken));
        return Convert.ToBase64String(digest).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    public async Task<NewBrowserSession> CreateAsync(Guid userId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var hours = Math.Clamp(config.GetValue("Auth:SessionHours", 8), 1, 24);
        var token = RandomProof();
        var csrf = CsrfProof(token);
        var until = now.AddHours(hours);
        db.UserSessions.Add(new UserSession(userId, Hash(token), Hash(csrf), now, until));
        await db.SaveChangesAsync(ct);
        return new NewBrowserSession(token, csrf, until);
    }

    public async Task<BrowserSession?> FindAsync(string? rawToken, CancellationToken ct)
    {
        // Validate the exact base64url length and character set before hashing.
        if (rawToken is not { Length: 43 } || rawToken.Any(c =>
            !(char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))) return null;
        var hash = Hash(rawToken);
        var now = DateTimeOffset.UtcNow;
        return await db.UserSessions.AsNoTracking()
            .Where(s => s.TokenHash == hash && s.ExpiresAt > now && s.RevokedAt == null)
            .Select(s => new BrowserSession(s.Id, s.UserId, s.CsrfHash, s.ExpiresAt))
            .SingleOrDefaultAsync(ct);
    }

    public async Task RevokeAsync(string? rawToken, CancellationToken ct)
    {
        if (rawToken is not { Length: 43 }) return;
        var hash = Hash(rawToken);
        await db.UserSessions.Where(s => s.TokenHash == hash && s.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, (DateTimeOffset?)DateTimeOffset.UtcNow), ct);
    }

    public async Task RevokeAllAsync(Guid userId, CancellationToken ct)
    {
        await db.UserSessions.Where(s => s.UserId == userId && s.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, (DateTimeOffset?)DateTimeOffset.UtcNow), ct);
    }

    public static bool VerifyCsrf(BrowserSession session, string? proof)
    {
        if (proof is not { Length: 43 } || proof.Any(c =>
            !(char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))) return false;
        return CryptographicOperations.FixedTimeEquals(
            Convert.FromHexString(session.CsrfHash), Convert.FromHexString(Hash(proof)));
    }
}
