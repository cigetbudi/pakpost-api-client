using System.Security.Cryptography;

namespace Pakpost.Infrastructure.Services;

public static class WorkspaceKeyRewrap
{
    public static string Rewrap(
        Guid workspaceId,
        string storedMasterKeyId,
        string wrappedKey,
        WorkspaceCryptography oldCrypto,
        WorkspaceCryptography newCrypto)
    {
        if (storedMasterKeyId != oldCrypto.MasterKeyId ||
            oldCrypto.MasterKeyId == newCrypto.MasterKeyId)
        {
            throw new CryptographicException("Workspace master key identifier mismatch");
        }

        var dek = oldCrypto.Unwrap(workspaceId, wrappedKey);

        try
        {
            if (dek.Length != 32)
            {
                throw new CryptographicException("Invalid workspace DEK length");
            }

            var rotated = newCrypto.Wrap(workspaceId, dek);
            var verified = newCrypto.Unwrap(workspaceId, rotated);

            try
            {
                if (!CryptographicOperations.FixedTimeEquals(dek, verified))
                {
                    throw new CryptographicException("New workspace wrapper verification failed");
                }
            }
            finally
            {
                CryptographicOperations.ZeroMemory(verified);
            }

            return rotated;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(dek);
        }
    }
}
