using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Pakpost.Domain.Entities;
using Pakpost.Infrastructure.Persistence;

namespace Pakpost.Api.Security;

public sealed record BrowserSession(Guid Id, Guid UserId, string CsrfHash, DateTimeOffset ExpiresAt, string? AvatarUrl = null);
public sealed record NewBrowserSession(string OpaqueToken, string CsrfToken, DateTimeOffset ExpiresAt);
public sealed record BrowserSessionInfo(Guid Id, string UserAgent, DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt, bool Current);

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

    public async Task<NewBrowserSession> CreateAsync(Guid userId, CancellationToken ct, string? userAgent = null, string? avatarUrl = null)
    {
        var now = DateTimeOffset.UtcNow;
        var hours = Math.Clamp(config.GetValue("Auth:SessionHours", 8), 1, 24);
        var token = RandomProof();
        var csrf = CsrfProof(token);
        var until = now.AddHours(hours);
        // User-Agent is display-only metadata. Do not store IPs, tokens, or browser fingerprints.
        var safeAgent = new string((userAgent ?? "").Take(256)
            .Select(c => char.IsControl(c) ? ' ' : c).ToArray());
        db.UserSessions.Add(new UserSession(userId, Hash(token), Hash(csrf), now, until, safeAgent, avatarUrl));
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
            .Where(s => s.TokenHash == hash && s.ExpiresAt > now && s.RevokedAt == null && db.Users.Any(u => u.Id == s.UserId && !u.IsDisabled))
            .Select(s => new BrowserSession(s.Id, s.UserId, s.CsrfHash, s.ExpiresAt, s.AvatarUrl))
            .SingleOrDefaultAsync(ct);
    }

    public async Task<IReadOnlyList<BrowserSessionInfo>> ListAsync(Guid userId, Guid currentId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var rows = await db.UserSessions.AsNoTracking()
            .Where(s => s.UserId == userId && s.RevokedAt == null && s.ExpiresAt > now)
            .OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id)
            .Take(50).Select(s => new { s.Id, s.UserAgent, s.CreatedAt, s.ExpiresAt })
            .ToListAsync(ct);
        return rows.Select(s => new BrowserSessionInfo(s.Id, s.UserAgent, s.CreatedAt,
            s.ExpiresAt, s.Id == currentId)).ToList();
    }

    public Task<bool> IsActiveAsync(Guid sessionId, CancellationToken ct) =>
        db.UserSessions.AsNoTracking().AnyAsync(s => s.Id == sessionId &&
            s.RevokedAt == null && s.ExpiresAt > DateTimeOffset.UtcNow &&
            db.Users.Any(u => u.Id == s.UserId && !u.IsDisabled), ct);

    public Task<int> RevokeOneAsync(Guid userId, Guid sessionId, CancellationToken ct) =>
        db.UserSessions.Where(s => s.Id == sessionId && s.UserId == userId &&
            s.RevokedAt == null).ExecuteUpdateAsync(s =>
            s.SetProperty(x => x.RevokedAt, (DateTimeOffset?)DateTimeOffset.UtcNow), ct);

    public Task<int> RevokeOthersAsync(Guid userId, Guid currentId, CancellationToken ct) =>
        db.UserSessions.Where(s => s.UserId == userId && s.Id != currentId &&
            s.RevokedAt == null).ExecuteUpdateAsync(s =>
            s.SetProperty(x => x.RevokedAt, (DateTimeOffset?)DateTimeOffset.UtcNow), ct);

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
