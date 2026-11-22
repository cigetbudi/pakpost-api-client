using System.Net;
using System.Net.Sockets;

namespace Pakpost.Infrastructure.Services;

// DNS pinning must allow only globally routable addresses in production.
internal static class ProxyAddressPolicy
{
    internal static bool IsPublic(IPAddress ip)
    {
        if(ip.IsIPv4MappedToIPv6) ip=ip.MapToIPv4();
        if(IPAddress.IsLoopback(ip))return false;
        var b=ip.GetAddressBytes();
        if(ip.AddressFamily==AddressFamily.InterNetwork)
        {
            int a=b[0],c=b[1];
            return a!=0 && a!=10 && a!=127 && a!=169 && a!=192 && a!=198 &&
                   a!=224 && a!=240 && a<224 &&
                   !(a==172 && c>=16 && c<=31) &&
                   !(a==100 && c>=64 && c<=127) &&
                   !(a==192 && c==168) &&
                   !(a==192 && c==0) &&
                   !(a==203 && c==0 && b[2]==113);
        }
        if(ip.AddressFamily==AddressFamily.InterNetworkV6)
        {
            // Only IPv6 global-unicast 2000::/3; reject tunnels and documentation addresses.
            // Do not trust IPv6 translation/tunneling as a way to access non-public IPv4.
            if((b[0]&0xe0)!=0x20 || ip.IsIPv6LinkLocal || ip.IsIPv6Multicast || ip.IsIPv6SiteLocal)
                return false;
            if(b[0]==0x20 && b[1]==0x02) return false; // 2002::/16 6to4 (embedded IPv4)
            if(b[0]==0x20 && b[1]==0x01 && b[2]==0x00 && b[3]==0x00) return false; // 2001::/32 Teredo
            if(b[0]==0x20 && b[1]==0x01 && b[2]==0x0d && b[3]==0xb8) return false; // documentation
            return true;
        }
        return false;
    }
}
