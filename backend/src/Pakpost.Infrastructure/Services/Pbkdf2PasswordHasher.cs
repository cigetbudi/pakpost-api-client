using System.Security.Cryptography;
using Pakpost.Application.Common.Interfaces;
namespace Pakpost.Infrastructure.Services;
public sealed class Pbkdf2PasswordHasher : IPasswordHasher
{
    private const int Iterations = 210_000;
    public string Hash(string password)
    {
        var salt=RandomNumberGenerator.GetBytes(16);
        var hash=Rfc2898DeriveBytes.Pbkdf2(password,salt,Iterations,HashAlgorithmName.SHA256,32);
        return $"pbkdf2-sha256${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }
    public bool Verify(string password,string storedHash)
    {
        try
        {
            var parts=storedHash.Split('$');
            if(parts.Length!=4 || parts[0]!="pbkdf2-sha256" || !int.TryParse(parts[1],out var i) || i<100_000 || i>1_000_000) return false;
            var salt=Convert.FromBase64String(parts[2]);var expected=Convert.FromBase64String(parts[3]);
            if(salt.Length!=16 || expected.Length!=32) return false;
            var actual=Rfc2898DeriveBytes.Pbkdf2(password,salt,i,HashAlgorithmName.SHA256,32);
            return CryptographicOperations.FixedTimeEquals(expected,actual);
        }
        catch(FormatException) { return false; }
    }
}
