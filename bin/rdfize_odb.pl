#!/usr/bin/perl -w
use strict;
use File::Basename;
use Getopt::Std;
my $PROGRAM = basename $0;
my $USAGE=
"Usage: $PROGRAM
";

my %OPT;
getopts('', \%OPT);

### Create RDF ###
my $ODB11 = "https://plant-oms.dbcls.jp/odb11";

print "\@prefix orthodb: <http://purl.orthodb.org/> .\n";
print "\@prefix upTax: <http://purl.uniprot.org/taxonomy/> .\n";
print "\n";

my %HASH;
while (<>) {
    chomp;
    my @f = split(/\t/, $_, -1);
    if (@f != 2) {
        die "$PROGRAM: $_: expected 2 fields\n";
    }
    my $odb_group_id = $f[0];
    my $odb_gene_id = $f[1];
    $HASH{$odb_group_id} = 1;
    print "<$ODB11/$odb_group_id> orthodb:hasMember <$ODB11/$odb_gene_id> .\n";
}

foreach my $odb_group_id (sort keys %HASH) {
    my $taxon;
    if ($odb_group_id =~ /^\d+at(\d+)$/) {
        $taxon = $1;
    } else {
        die "$PROGRAM: $odb_group_id: invalid format\n";
    }
    print "<$ODB11/$odb_group_id> orthodb:ogBuiltAt upTax:$taxon .\n";
}
