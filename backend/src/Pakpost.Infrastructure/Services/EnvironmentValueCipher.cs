using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Pakpost.Application.Common.Interfaces;
namespace Pakpost.Infrastructure.Services;
public sealed class EnvironmentValueCipher(IConfiguration configuration) : IEnvironmentValueCipher
{
    private byte[] GetKey()
    {
        var raw=configuration["EnvironmentEncryption:Key"];
        if (string.IsNullOrWhiteSpace(raw)) throw new InvalidOperationException("EnvironmentEncryption__Key must be configured before saving secret environment variables");
        byte[] key;
        try { key=Convert.FromBase64String(raw); }
        catch(FormatException) { throw new InvalidOperationException("EnvironmentEncryption__Key must be Base64 (32 random bytes)"); }
        if(key.Length!=32) throw new InvalidOperationException("EnvironmentEncryption__Key must contain exactly 32 random bytes");
        return key;
    }
    public string Protect(string clear)
    {
        var nonce=RandomNumberGenerator.GetBytes(12);
        var bytes=Encoding.UTF8.GetBytes(clear);
        var ciphertext=new byte[bytes.Length];var tag=new byte[16];
        using(var aes=new AesGcm(GetKey(),16)) aes.Encrypt(nonce,bytes,ciphertext,tag);
        return "v1:"+Convert.ToBase64String(nonce.Concat(tag).Concat(ciphertext).ToArray());
    }
    public string Unprotect(string encoded)
    {
        if(!encoded.StartsWith("v1:",StringComparison.Ordinal)) throw new InvalidOperationException("Unknown environment secret cipher version");
        var raw=Convert.FromBase64String(encoded[3..]);
        if(raw.Length<28)throw new InvalidOperationException("Invalid environment secret ciphertext");
        var clear=new byte[raw.Length-28];
        using(var aes=new AesGcm(GetKey(),16)) aes.Decrypt(raw.AsSpan(0,12),raw.AsSpan(28),raw.AsSpan(12,16),clear);
        return Encoding.UTF8.GetString(clear);
    }
}
