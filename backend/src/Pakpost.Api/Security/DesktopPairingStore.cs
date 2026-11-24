using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Pakpost.Api.Security;

// Temporary pairing requests live only in server memory (five minute TTL).
// For horizontally scaled deployments, replace this with a shared distributed store.
public sealed class DesktopPairingStore
{
    private sealed class Pending
    {
        public required string SecretHash { get; init; }
        public required DateTimeOffset ExpiresAt { get; init; }
        public Guid? ApprovedUserId { get; set; }
        public string? ApprovedAvatarUrl { get; set; }
        public bool Consumed { get; set; }
        public readonly object Gate = new();
    }

    private readonly ConcurrentDictionary<string, Pending> _pending = new();
    public sealed record Started(string RequestId, string DeviceSecret, DateTimeOffset ExpiresAt);

    public Started Start()
    {
        // Bounded memory even when clients abandon attempts.
        foreach (var (id, pending) in _pending)
            if (pending.ExpiresAt <= DateTimeOffset.UtcNow) _pending.TryRemove(id, out _);
        if (_pending.Count >= 1000) throw new InvalidOperationException("Too many pending desktop logins");
        var idNew = ServerSessionStore.RandomProof();
        var secret = ServerSessionStore.RandomProof();
        var expires = DateTimeOffset.UtcNow.AddMinutes(5);
        _pending[idNew] = new Pending { SecretHash = ServerSessionStore.Hash(secret), ExpiresAt = expires };
        return new Started(idNew, secret, expires);
    }

    public bool Approve(string id, Guid userId, string? avatarUrl)
    {
        if (!_pending.TryGetValue(id, out var p)) return false;
        lock (p.Gate)
        {
            if (p.ExpiresAt <= DateTimeOffset.UtcNow || p.Consumed || p.ApprovedUserId is not null) return false;
            p.ApprovedUserId = userId;
            p.ApprovedAvatarUrl = avatarUrl;
            return true;
        }
    }

    public enum Status { Invalid, Pending, Approved }
    public Status Consume(string id, string secret, out Guid userId, out string? avatarUrl)
    {
        userId = default;
        avatarUrl = null;
        if (id.Length != 43 || secret.Length != 43 || !_pending.TryGetValue(id, out var p)) return Status.Invalid;
        var digest = Convert.FromHexString(ServerSessionStore.Hash(secret));
        var expected = Convert.FromHexString(p.SecretHash);
        if (!CryptographicOperations.FixedTimeEquals(digest, expected)) return Status.Invalid;
        lock (p.Gate)
        {
            if (p.ExpiresAt <= DateTimeOffset.UtcNow || p.Consumed) return Status.Invalid;
            if (p.ApprovedUserId is null) return Status.Pending;
            userId = p.ApprovedUserId.Value;
            avatarUrl = p.ApprovedAvatarUrl;
            p.Consumed = true;
            _pending.TryRemove(id, out _);
            return Status.Approved;
        }
    }
}
